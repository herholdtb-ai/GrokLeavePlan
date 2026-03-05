import wixData from 'wix-data';
import wixLocation from 'wix-location';

/**
 * Leave Request Page Code
 * Enhanced with Domain Locking, Real-time Calendar Day Calculation,
 * Prefill via Querystring (id, mode), and Vetted Supervisor Selection.
 */

$w.onReady(async function () {
    // 1) Initial UI setup
    setupSupervisorDropdown();

    // 2) Real-time duration feedback
    $w("#startingDate").onChange(() => {
        calculateCalendarDays();
    });
    $w("#endDate").onChange(() => {
        calculateCalendarDays();
    });

    // 3) Optional: Set minimum date for pickers to today
    const today = new Date();
    $w("#startingDate").minDate = today;
    $w("#endDate").minDate = today;

    // 4) Prefill via querystring (?id=...&mode=...)
    try {
        const { id, mode } = wixLocation.query || {};

        if (id) {
            const request = await wixData.get("LeaveApplications", id);

            // Prefill common form fields (adjust IDs to your actual elements)
            if (request.startingDate) $w("#startingDate").value = new Date(request.startingDate);
            if (request.endDate) $w("#endDate").value = new Date(request.endDate);

            // If you bind to a dataset, you can also set field values directly:
            // $w("#datasetLeave").setFieldValue("startingDate", request.startingDate);
            // $w("#datasetLeave").setFieldValue("endDate", request.endDate);

            // Example additional fields (uncomment / adapt to your schema & control IDs)
            // $w("#txtReason").value = request.reason || "";
            // $w("#dropdownSupervisor").value = request.actingSupervisorEmail || request.master_supervisor || "";

            // Recalculate after prefill
            calculateCalendarDays();

            // Optional: change UI if revising
            if (mode === "revise") {
                // e.g., show a label or banner informing user they are revising
                // $w("#lblReviseBanner").text = "You are revising a previous request.";
                // $w("#lblReviseBanner").show();

                // Potentially lock fields that must not change in revise mode
                // $w("#startingDate").disable();
                // $w("#endDate").disable();

                // If using dataset mode, store the original ID for update (if your flow supports update instead of creating a new record)
                // $w("#datasetLeave").setFieldValue("_id", request._id);
            }
        }
    } catch (err) {
        console.error("Prefill error:", err);
        // Optionally show a user-facing message if prefill fails
        // $w("#txtFormMessage").text = "Could not prefill the form. You can still proceed by entering the details.";
        // $w("#txtFormMessage").show();
    }
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
            // @ts-ignore (Wix Editor will allow style access; guard if needed)
            $w("#txtTotalDays").style.color = "red";
            return;
        }

        // Calculate difference in milliseconds
        const startTime = new Date(start).setHours(0, 0, 0, 0);
        const endTime = new Date(end).setHours(0, 0, 0, 0);
        const diffTime = Math.abs(endTime - startTime);

        // Convert to days and add 1 to make it inclusive
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

        $w("#txtTotalDays").text = `${diffDays} Kalenderdag(e)`;
        // @ts-ignore
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
        // Optionally: surface an error label/message
        // $w("#txtFormMessage").text = "Kies asb. 'n begin- en einddatum.";
        // $w("#txtFormMessage").show();
        return;
    }

    if (end < start) {
        // Prevent submission of invalid date ranges
        event.preventDefault();
        // $w("#txtFormMessage").text = "Die einddatum kan nie voor die begindatum wees nie.";
        // $w("#txtFormMessage").show();
        return;
    }

    // Set actingSupervisorEmail from dropdown value
    $w("#datasetLeave").setFieldValue("actingSupervisorEmail", $w("#dropdownSupervisor").value);

    // (Optional) If revising and you want to explicitly mark mode in the record:
    // const { mode } = wixLocation.query || {};
    // if (mode === "revise") {
    //     $w("#datasetLeave").setFieldValue("revisionMode", true);
    // }
}
