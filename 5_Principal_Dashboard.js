import wixData from 'wix-data';

/**
 * PAGE: Principal Dashboard
 * Manages User Registrations and Leave Applications.
 */

$w.onReady(function () {
    loadRegistrationQueue();
    loadLeaveQueue();
});

// --- SECTION 1: USER REGISTRATIONS ---

async function loadRegistrationQueue() {
    try {
        // Find users who are DH-confirmed but not yet Principal-approved
        const results = await wixData.query("UserRegistry")
            .eq("status", "Confirmed Supervisor")
            .find();

        if (results.items.length > 0) {
            $w('#repeaterRegistrations').data = results.items;
            $w('#repeaterRegistrations').onItemReady(($item, itemData) => {
                $item('#txtName').text = itemData.title;
                $item('#txtEmail').text = itemData.email;
                $item('#txtDH').text = `Vouched by: ${itemData.supervisorEmail}`;

                $item('#btnApproveUser').onClick(async () => {
                    $item('#btnApproveUser').disable();
                    await updateUserStatus(itemData._id, "Approved");
                });

                $item('#btnDeclineUser').onClick(async () => {
                    $item('#btnDeclineUser').disable();
                    await updateUserStatus(itemData._id, "Declined");
                });
            });
            $w('#repeaterRegistrations').show();
        } else {
            $w('#repeaterRegistrations').hide();
        }
    } catch (err) {
        console.error("User queue error:", err);
    }
}

async function updateUserStatus(id, newStatus) {
    const user = await wixData.get("UserRegistry", id);
    user.status = newStatus;
    await wixData.update("UserRegistry", user);
    // The registration.jsw afterUpdate hook will automatically send the email
    loadRegistrationQueue(); 
}

// --- SECTION 2: LEAVE APPLICATIONS ---

async function loadLeaveQueue() {
    try {
        // Query for leave requests waiting for Principal review
        const results = await wixData.query("LeaveApplications")
            .eq("applicationStatus", "Pending: Principal")
            .find();

        if (results.items.length > 0) {
            $w('#repeaterLeave').data = results.items;
            $w('#repeaterLeave').onItemReady(($item, itemData) => {
                const s = itemData.startingDate ? new Date(itemData.startingDate).toLocaleDateString() : "?";
                const e = itemData.endDate ? new Date(itemData.endDate).toLocaleDateString() : "?";

                $item('#txtApplicant').text = itemData.applicantEmail;
                $item('#txtDates').text = `${s} - ${e}`;
                $item('#txtDHRemarks').text = `DH Remarks: ${itemData.supervisorRemarks || "None"}`;

                $item('#btnApproveLeave').onClick(async () => {
                    $item('#btnApproveLeave').disable();
                    await processLeave(itemData._id, "Approved", "Complete", $item('#inpPrinRemarks').value);
                });

                $item('#btnRejectLeave').onClick(async () => {
                    $item('#btnRejectLeave').disable();
                    await processLeave(itemData._id, "Rejected", "Complete", $item('#inpPrinRemarks').value);
                });
            });
            $w('#repeaterLeave').show();
        } else {
            $w('#repeaterLeave').hide();
        }
    } catch (err) {
        console.error("Leave queue error:", err);
    }
}

// Combined logic from Block 1 + Block 2
async function processLeave(id, decision, status, remarks) {
    const item = await wixData.get("LeaveApplications", id);

    item.principalDecision = decision;
    item.principalRemarks = remarks;

    // --- Block 2 rule: derive applicationStatus from decision ---
    if (decision === "Rejected") {
        item.applicationStatus = "Rejected - Revise";
    } else {
        item.applicationStatus = "Complete";
    }

    await wixData.update("LeaveApplications", item);
    // The data.js afterUpdate hook will send the cumulative email
    loadLeaveQueue();
}
