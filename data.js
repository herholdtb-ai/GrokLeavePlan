import { ForbiddenError } from 'wix-errors';
import wixData from 'wix-data';
import { generateSecureToken } from 'backend/security.jsw';
import { sendSecureEmail } from 'backend/sendGrid.jsw';
import { addToOutlookCalendar } from 'backend/outlook.jsw'; // <-- Assume this exists

/**
 * DATABASE HOOKS (data.js)
 * HS Grabouw Leave Application System
 */

const SCHOOL_DOMAIN = "@hsgrabouw.co.za";

/* ============================================================
   BEFORE INSERT — Overlap detection + optional domain checks
   ============================================================ */
export async function LeaveApplications_beforeInsert(item, context) {

    // Optional domain lock (disabled by default)
    // if (!String(item.applicantEmail || "").endsWith(SCHOOL_DOMAIN)) {
    //     throw new ForbiddenError("Only @hsgrabouw.co.za accounts may submit leave requests.");
    // }

    // --- OORVLEUELING TOETS ---
    const start = item.startingDate ? new Date(item.startingDate) : null;
    const end   = item.endDate ? new Date(item.endDate) : null;

    if (start && end) {
        // Overlap rule:
        // existing.endDate >= new.start  AND  existing.startingDate <= new.end
        const baseFilters = (q) =>
            q.eq("applicantEmail", item.applicantEmail)
             .ge("endDate", start)
             .le("startingDate", end);

        const overlapsComplete =
            baseFilters(wixData.query("LeaveApplications"))
                .eq("applicationStatus", "Complete");

        const overlapsPending =
            baseFilters(wixData.query("LeaveApplications"))
                .startsWith("applicationStatus", "Pending");

        const overlaps = await overlapsComplete.or(overlapsPending).find();

        if (overlaps.items.length > 0) {
            item.overlapWarning = "Warning: Overlaps with existing leaves";
        }
    }

    return item;
}

/* ============================================================
   BEFORE UPDATE — Handles "Rejected - Revise" resubmissions
   ============================================================ */
export function LeaveApplications_beforeUpdate(item, context) {
    const prev = context.previousItem;

    // If the user is revising their previously rejected leave request:
    if (prev.applicationStatus === "Rejected - Revise") {

        // Reset status back to Supervisor stage
        item.applicationStatus = "Pending: Supervisor";

        // Clear old decisions
        item.supervisorDecision = null;
        item.principalDecision = null;
    }

    return item;
}

/* ============================================================
   UTILITY — Calendar Summary for email notifications
   ============================================================ */
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

/* ============================================================
   AFTER INSERT — Sends Supervisor/Principal review emails
   ============================================================ */
export async function LeaveApplications_afterInsert(item, context) {
    const summary = await getCalendarSummary(item.applicantEmail);

    if (item.applicationStatus === "Pending: Supervisor") {

        const token = await generateSecureToken(
            item.master_supervisor,
            "dhReview",
            { requestId: item._id }
        );

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

        const token = await generateSecureToken(
            item.principalEmail,
            "principalReview",
            { requestId: item._id }
        );

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

/* ============================================================
   AFTER UPDATE — DH → Principal escalation + Outlook add event
   ============================================================ */
export async function LeaveApplications_afterUpdate(item, context) {
    const original = context.previousItem;

    // A) When DH approves → status changes to "Pending: Principal"
    if (
        item.applicationStatus === "Pending: Principal" &&
        original.applicationStatus !== "Pending: Principal"
    ) {
        const summary = await getCalendarSummary(item.applicantEmail);
        const principalAddress = item.principalEmail || "principal@example.com";

        const token = await generateSecureToken(
            principalAddress,
            "principalReview",
            { requestId: item._id }
        );

        const body = `Leave request from ${item.applicantEmail} supported by DH.\n\n${summary}`;

        await sendSecureEmail(
            principalAddress,
            "Principal Decision Required",
            "approve-request",
            token,
            "Approve or Reject",
            body
        );
    }

    // B) When Principal decision transitions to Approved → add to Outlook calendar
    if (
        item.principalDecision === "Approved" &&
        original.principalDecision !== "Approved"
    ) {
        try {
            await addToOutlookCalendar({
                applicantName: item.applicantEmail, // replace with a proper name field if available
                startDate: item.startingDate,
                endDate: item.endDate,
                reason: item.reason
            });
        } catch (e) {
            // Log but do not block the DB update lifecycle
            console.error("Outlook calendar add failed:", e);
        }
    }

    return item;
}
