import wixData from 'wix-data';

$w.onReady(async function () {
    const results = await wixData.query("LeaveApplications")
        .eq("applicationStatus", "Complete")
        .find();

    // Aggregate trends (example: total days per month)
    let monthly = {};
    results.items.forEach(item => {
        const month = item.startingDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthly[month] = (monthly[month] || 0) + item.totalDays;
    });

    // Display in table
    const tableData = Object.entries(monthly).map(([month, days]) => ({ month, days }));
    $w('#tableReports').rows = tableData;

    // Department summaries (assume department field in UserRegistry)
    // Similar aggregation
});
