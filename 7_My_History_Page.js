import wixData from 'wix-data';
import wixUsers from 'wix-users';
import wixLocation from 'wix-location';

/**
 * PAGE: My Leave History
 * Displays all past and current leave requests for the logged-in staff member.
 */

$w.onReady(async function () {
    const user = wixUsers.currentUser;
    if (user.loggedIn) {
        const email = await user.getEmail();
        loadHistory(email);
    } else {
        // Optionally: show a prompt or redirect
        // if ($w('#txtNoHistory')) { $w('#txtNoHistory').text = 'Please sign in to view your leave history.'; $w('#txtNoHistory').show(); }
    }
});

async function loadHistory(email) {
    try {
        // Query for all requests by this applicant, sorted by most recent
        const results = await wixData.query("LeaveApplications")
            .eq("applicantEmail", email)
            .descending("submissionTimestamp")
            .find();

        if (results.items.length > 0) {
            $w('#repeaterHistory').data = results.items;

            $w('#repeaterHistory').onItemReady(($item, itemData) => {
                // --- 1) Status and Dates ---
                const s = itemData.startingDate
                    ? new Date(itemData.startingDate).toLocaleDateString()
                    : "?";
                const e = itemData.endDate
                    ? new Date(itemData.endDate).toLocaleDateString()
                    : "?";

                $item('#txtStatus').text = `Status: ${itemData.applicationStatus}`;
                $item('#txtDateRange').text = `${s} to ${e}`;

                // --- 2) Supervisor Info ---
                $item('#txtMasterSupervisor').text =
                    `Reviewed by: ${itemData.master_supervisor || "Pending"}`;

                // --- 3) Contingency Summary ---
                const p = itemData.contingencyData;
                $item('#txtContingency').text =
                    `P1: ${p?.period1 || "-"} | P2: ${p?.period2 || "-"} | P3: ${p?.period3 || "-"} | P4: ${p?.period4 || "-"}`;

                // --- 4) Decision Trail ---
                $item('#txtSupDecision').text =
                    `Supervisor: ${itemData.supervisorDecision || "Pending"}`;
                $item('#txtSupRemarks').text = itemData.supervisorRemarks || "";

                $item('#txtPrinDecision').text =
                    `Principal: ${itemData.principalDecision || "Pending"}`;
                $item('#txtPrinRemarks').text = itemData.principalRemarks || "";

                // --- 5) Visual Feedback ---
                if (typeof $item('#statusBox')?.style?.backgroundColor !== "undefined") {
                    if (itemData.applicationStatus === "Complete") {
                        $item('#statusBox').style.backgroundColor = "#D4EDDA"; // Light Green
                    } else if (
                        typeof itemData.applicationStatus === "string" &&
                        itemData.applicationStatus.includes("Pending")
                    ) {
                        $item('#statusBox').style.backgroundColor = "#FFF3CD"; // Light Yellow
                    }
                }

                // --- 6) Revise Button + Tooltip/Label + Prefill Querystring ---
                // Show only when the request is rejected for revision
                const btn = $item('#btnRevise');
                const lbl = $item('#lblReviseHelp'); // Text element next to the button (hidden by default)

                if (itemData.applicationStatus === "Rejected - Revise" && btn) {
                    // Set tooltip if supported by your button (works in many Wix components)
