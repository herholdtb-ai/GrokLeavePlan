import { ForbiddenError } from 'wix-errors';
import wixData from 'wix-data';
import { generateSecureToken } from 'backend/security.jsw'; // Assume this exists
import { sendSecureEmail } from 'backend/sendGrid.jsw';

/**
 * DATABASE HOOKS (data.js)
 * * This file centralizes security and logic for the HS Grabouw Leave Application System.
 * It enforces the @hsgrabouw.co.za domain restriction and inclusive calendar day calculations.
 */

const SCHOOL_DOMAIN = "@hsgrabouw.co.za";

/**
 * Hook for the LeaveApplications collection.
 * Triggers before a leave request is saved to the database.
 */
export async function LeaveApplications_beforeInsert(item, context) {
    // --- (existing domain/sekuriteit/logika kan hier bly) ---
    // Voorbeeld (indien reeds in jou bestaande kode):
    // if (!String(item.applicantEmail || "").endsWith(SCHOOL_DOMAIN)) {
    //     throw new ForbiddenError("Only @hsgrabouw.co.za accounts may submit leave requests.");
    // }

    // --- OORVLEUELING-TOETS ---
    const start = item.startingDate ? new Date(item.startingDate) : null;
    const end = item.endDate ? new Date(item.endDate) : null;

    if (start && end) {
        // Oorvleueling: existing.endDate >= new.start AND existing.startingDate <= new.end
        const baseFilters = (q) =>
            q.eq("applicantEmail", item.applicantEmail)
             .ge("endDate", start)
             .le("startingDate", end);

        const overlapsComplete = baseFilters(wixData.query("LeaveApplications"))
            .eq("applicationStatus", "Complete");

        const overlapsPending = baseFilters(wixData.query("LeaveApplications"))
            .startsWith("applicationStatus", "Pending");

        const overlaps = await overlapsComplete.or(overlapsPending).find();

        if (overlaps.items.length > 0) {
            // Stel ’n waarskuwingsveld — of gooi ’n fout as jy wil blok.
            item.overlapWarning = "Warning: Overlaps with existing leaves";
        }
    }

    return item;
}

/**
 * Helper: Bou ’n eenvoudige kalenderopsomming vir die aansoeker se bestaande aansoeke.
 */
async function getCalendarSummary(email) {
    const leaves = await wixData.query("LeaveApplications")
        .eq("applicantEmail", email)
        .ascending("startingDate")
        .find();

    let summary = "Applicant's Leave Calendar:\n";
    leaves.items.forEach(l => {
        const s = l.startingDate ? new Date(l.startingDate).toLocaleDateString() : "?";
        const e = l.endDate ? new Date(l.endDate).toLocaleDateString() : "?";
        summary += `- ${s} to ${e} (${l.applicationStatus})\n`;
    });
    return summary;
}

/**
 * Hook for LeaveApplications after insert (send review email with tokens)
 */
export async function LeaveApplications_afterInsert(item, context) {
    const summary = await getCalendarSummary(item.applicantEmail);
    if (item.applicationStatus === "Pending: Supervisor") {
        const token = await generateSecureToken(item.master_supervisor, "dhReview", { requestId: item._id });
        const body = `New leave request from ${item.applicantEmail}.\n\n${summary}`;
        await sendSecureEmail(
            item.master_supervisor,
            "Review Leave Request",
            "approve-request",
            token,
            "View & Decide",
            body
        );
    } else if (item.applicationStatus === "Pending: Principal") {
        const token = await generateSecureToken(item.principalEmail, "principalReview", { requestId: item._id });
        const body = `New leave request from ${item.applicantEmail}.\n\n${summary}`;
        await sendSecureEmail(
            item.principalEmail,
            "Principal Review Required",
            "approve-request",
            token,
            "View & Decide",
            body
        );
    }
    return item;
}

/**
 * Hook for LeaveApplications after update (e.g., after DH, send to principal with token)
 */
export async function LeaveApplications_afterUpdate(item, context) {
    const original = context.previousItem;

    if (item.applicationStatus === "Pending: Principal" && original.applicationStatus !== "Pending: Principal") {
        const summary = await getCalendarSummary(item.applicantEmail);
        // Gebruik die item se principalEmail as beskikbaar; val terug op ’n konfig-waarde indien nodig.
        const principalAddress = item.principalEmail || "principal@example.com";

