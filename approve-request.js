import wixData from 'wix-data';
import { processApproval } from 'backend/approval.jsw';

$w.onReady(async function () {
    const token = $w('#dynamicDataset').getCurrentItem().token; // Or from query param: wixLocation.query.token
    const requestId = // Extract from token validation or query

    // Load summary
    const request = await wixData.get("LeaveApplications", requestId);
    $w('#txtSummary').text = `Request from ${request.applicantEmail}: ${request.startingDate} to ${request.endDate}`;

    $w('#btnSupport').onClick(async () => {
        await processApproval(token, "support"); // For DH
        $w('#txtStatus').text = "Decision submitted.";
    });

    // Similar for reject, approve, etc.
});
