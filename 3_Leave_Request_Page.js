import wixData from 'wix-data';

/**
 * Leave Request Page Code
 * Enhanced with Domain Locking, Real-time Calendar Day Calculation, 
 * and Vetted Supervisor Selection.
 */

$w.onReady(function () {
    // 1. Initial UI Setup
    setupSupervisorDropdown();
    
    // 2. Set up event listeners for real-time duration feedback
    $w("#startingDate").onChange(() => {
        calculateCalendarDays();
    });
    
    $w("#endDate").onChange(() => {
        calculateCalendarDays();
    });

    // 3. Optional: Set minimum date for pickers to today
    const today = new Date();
    $w("#startingDate").minDate = today;
    $w("#endDate").minDate = today;
});

/**
 * Populates the supervisor dropdown with approved staff members 
 * holding @hsgrabouw.co.za email addresses.
 */
async function setupSupervisorDropdown() {
    try {
        const results = await wixData.query("UserRegistry")
            .eq("status", "Approved")
            .endsWith("email", "@hsgrabouw.co.za")
            .ascending("title") // Sort by Name
            .find();

        if (results.items.length > 0) {
            const options = results.items.map(user => {
                return {
                    label: user.title, // Staff Name
                    value: user.email  // Staff Email used for routing
                };
            });

            $w("#dropdownSupervisor").options = options;
            $w("#dropdownSupervisor").placeholder = "Kies 'n Waarnemende Toesighouer (Opsioneel)";
        } else {
            $w("#dropdownSupervisor").placeholder = "Geen goedgekeurde toesighouers gevind nie";
        }
    } catch (err) {
        console.error("Error loading supervisors:", err);
    }
}

/**
 * Calculates the inclusive calendar day count (End - Start + 1).
 * Updates the UI text element in real-time.
 */
function calculateCalendarDays() {
    const start = $w("#startingDate").value;
    const end = $w("#endDate").value;

    if (start && end) {
        // Ensure end date is not before start date
        if (end < start) {
            $w("#txtTotalDays").text = "Ongeldige datumreeks";
            $w("#txtTotalDays").style.color = "red";
            return;
        }

        // Calculate difference in milliseconds
        const diffTime = Math.abs(end - start);
        
        // Convert to days and add 1 to make it inclusive
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        $w("#txtTotalDays").text = `${diffDays} Kalenderdag(e)`;
        $w("#txtTotalDays").style.color = "black";
    } else {
        $w("#txtTotalDays").text = "Kies datums om totaal te sien";
    }
}

/**
 * Validation before submission (triggered by the dataset or custom button)
 */
export function btnSubmit_click(event) {
    const start = $w("#startingDate").value;
    const end = $w("#endDate").value;

    if (!start || !end) {
        // Show error message if dates are missing
        return;
    }

    if (end < start) {
        // Prevent submission of invalid date ranges
        event.preventDefault();
        return;
    }

    // NEW: Set actingSupervisorEmail from dropdown value
    $w("#datasetLeave").setFieldValue("actingSupervisorEmail", $w("#dropdownSupervisor").value);
}
