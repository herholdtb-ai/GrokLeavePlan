import { getSecret } from 'wix-secrets-backend';
import sgMail from '@sendgrid/mail';
import wixData from 'wix-data';

// Configuration
const SENDER_EMAIL = "info@hsgrabouw.co.za";
const PRINCIPAL_EMAIL = "bezuidenhouth@hsgrabouw.co.za";
const BASE_URL = "https://www.hsgrabouw.co.za";

/**
 * Internal Utility: Sends a SendGrid email
 */
async function sendEmail(to, subject, body) {
    try {
        const apiKey = await getSecret("SENDGRID_API_KEY");
        sgMail.setApiKey(apiKey);
        const msg = {
            to: to,
            from: SENDER_EMAIL,
            subject: subject,
            text: body,
        };
        await sgMail.send(msg);
        return { success: true };
    } catch (error) {
        console.error("SendGrid Notification Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * STEP 1: Initial Registration
 * Triggered by the Frontend Registration Page.
 */
export async function registerStaff(staffData) {
    try {
        const item = {
            ...staffData,
            status: "Unverified",
            emailVerified: false,
            supervisorConfirmed: false,
            registrationTimestamp: new Date()
        };

        const inserted = await wixData.insert("UserRegistry", item);
        
        const verifyLink = `${BASE_URL}/verify-email?id=${inserted._id}`;
        
        const subject = "HS Grabouw: Verifieer jou e-pos / Verify your email";
        const body = `Welkom by die HS Grabouw Verlofstelsel.\n\n` +
                     `Klik asseblief op die skakel hieronder om jou e-posadres te verifieer:\n${verifyLink}\n\n` +
                     `Sodra jy geverifieer is, sal jou departementshoof (${item.supervisorEmail}) gevra word om jou diens aan te bevestig.`;
        
        await sendEmail(inserted.email, subject, body);
        return { success: true, id: inserted._id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * STEP 2: Applicant Email Verification Handshake
 * Triggers the Employment Confirmation email to the Supervisor.
 */
export async function verifyUserEmail(userId) {
    try {
        const user = await wixData.get("UserRegistry", userId);
        
        if (user && user.status === "Unverified") {
            user.status = "Pending";
            user.emailVerified = true;
            await wixData.update("UserRegistry", user);

            const confirmLink = `${BASE_URL}/confirm-staff?id=${user._id}`;
            const supSubject = `Bevestig Diensaanvaarding / Confirm Employment: ${user.title}`;
            const supBody = `Geagte Departementshoof,\n\n` +
                           `${user.title} het op die verlofstelsel geregistreer.\n\n` +
                           `Bevestig asseblief dat hierdie personeellid tans in diens is en korrek aan u rapporteer deur op die skakel hieronder te klik:\n${confirmLink}\n\n` +
                           `Na u bevestiging sal die aansoek na die Prinsipaal gaan vir finale goedkeuring.`;
            
            await sendEmail(user.supervisorEmail, supSubject, supBody);
            return { success: true };
        }
        return { success: false, message: "Link expired or already verified." };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * STEP 3: Supervisor Reporting-Line Confirmation
 * Triggers the One-Click Authorization email to the Principal.
 */
export async function supervisorConfirmStaff(userId) {
    try {
        const user = await wixData.get("UserRegistry", userId);
        
        if (user && user.status === "Pending") {
            user.status = "Confirmed Supervisor";
            user.supervisorConfirmed = true;
            await wixData.update("UserRegistry", user);
            
            // New: Principal Direct Authorization Link
            const principalApproveLink = `${BASE_URL}/principal-authorize?id=${user._id}`;
            
            const prinSubject = `Aksie Vereis: Nuwe Personeel Goedkeuring - ${user.title}`;
            const prinBody = `Meneer Bezuidenhout,\n\n` +
                           `Nuwe personeellid ${user.title} se e-pos is geverifieer en hul diens is deur DH (${user.supervisorEmail}) bevestig.\n\n` +
                           `Om hierdie rekening onmiddellik GOED TE KEUR, klik op die skakel hieronder:\n${principalApproveLink}\n\n` +
                           `Indien u die aansoek wil afkeur, doen dit asseblief via die hoof-dashboard op Wix.`;
            
            await sendEmail(PRINCIPAL_EMAIL, prinSubject, prinBody);
            return { success: true };
        }
        return { success: false };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * STEP 4: Principal Direct Authorization
 * Triggered by the /principal-authorize hidden page script.
 */
export async function principalAuthorizeStaff(userId) {
    try {
        const user = await wixData.get("UserRegistry", userId);
        
        // Ensure the account is in the correct state for approval
        if (user && user.status === "Confirmed Supervisor") {
            user.status = "Approved";
            await wixData.update("UserRegistry", user);
            
            // The afterUpdate hook below handles the notification to the user.
            return { success: true };
        }
        return { success: false, message: "Account already approved or not ready." };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * STEP 5: Final Status Notification (Hook)
 * Sends 'Welcome' or 'Declined' email based on Principal's action (Dashboard or Email Link).
 */
export async function UserRegistry_afterUpdate(item, context) {
    const originalItem = context.currentItem;

    if (originalItem && originalItem.status !== item.status) {
        let subject = "";
        let body = "";

        if (item.status === "Approved") {
            subject = "HS Grabouw: Rekening Goedgekeur / Account Approved";
            body = `Geagte ${item.title},\n\n` +
                   `U rekening op die HS Grabouw digitale verlofstelsel is nou amptelik goedgekeur.\n\n` +
                   `U kan nou aanmeld om verlofversoeke aanlyn in te dien by: ${BASE_URL}/leave-request\n\nVriendelike groete,\nHS Grabouw Administrasie`;
        } 
        else if (item.status === "Declined") {
            subject = "HS Grabouw: Rekening Geweier / Account Declined";
            body = `Geagte ${item.title},\n\n` +
                   `U registrasie vir die verlofstelsel is ongelukkig nie goedgekeur nie. Kontak asseblief die administrasie vir meer inligting.`;
        }

        if (subject) {
            await sendEmail(item.email, subject, body);
        }
    }
    return item;
}

