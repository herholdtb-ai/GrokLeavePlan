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
export function LeaveApplications_beforeInsert(item, context) {
    // ... (existing code remains)

    return item;
}

/**
 * Hook for LeaveApplications after insert (send review email with tokens)
 */
export async function LeaveApplications_afterInsert(item, context) {
    // Generate token for DH if pending supervisor
    if (item.applicationStatus === "Pending: Supervisor") {
        const token = await generateSecureToken(item.master_supervisor, "dhReview", { requestId: item._id });
        const body = `New leave request from ${item.applicantEmail}.`;
        await sendSecureEmail(item.master_supervisor, "Review Leave Request", "approve-request", token, "View & Decide", body);
    } else if (item.applicationStatus === "Pending: Principal") {
        const token = await generateSecureToken(item.principalEmail, "principalReview", { requestId: item._id }); // Adjust for principal
        const body = `New leave request from ${item.applicantEmail}.`;
        await sendSecureEmail(item.principalEmail, "Principal Review Required", "approve-request", token, "View & Decide", body);
    }
    return item;
}

/**
 * Hook for LeaveApplications after update (e.g., after DH, send to principal with token)
 */
export async function LeaveApplications_afterUpdate(item, context) {
    const original = context.previousItem;

    if (item.applicationStatus === "Pending: Principal" && original.applicationStatus !== "Pending: Principal") {
        const token = await generateSecureToken("principal@example.com", "principalReview", { requestId: item._id }); // Hardcode or from config
        const body = `Leave request from ${item.applicantEmail} supported by DH.`;
        await sendSecureEmail("principal@example.com", "Principal Decision Required", "approve-request", token, "Approve or Reject", body);
    }

    return item;
}

/**
 * ... (other hooks remain)
 */
