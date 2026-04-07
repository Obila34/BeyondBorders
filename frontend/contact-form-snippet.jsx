import { useState } from "react";

const initialValues = {
    name: "",
    email: "",
    phone: "",
    interest: "",
    travelWindow: "",
    groupSize: "",
    message: ""
};

function validate(values) {
    const errors = {};

    if (values.name.trim().length < 2) {
        errors.name = "Use at least two characters.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = "Enter a valid email address.";
    }

    if (values.phone.trim() && values.phone.replace(/\D/g, "").length < 9) {
        errors.phone = "Use a valid phone number.";
    }

    if (!values.interest) {
        errors.interest = "Select the journey you want.";
    }

    if (!values.groupSize) {
        errors.groupSize = "Select the expected group size.";
    }

    if (values.travelWindow.trim() && values.travelWindow.trim().length < 4) {
        errors.travelWindow = "Add a month or date range.";
    }

    if (values.message.trim().length < 24) {
        errors.message = "Share a few more trip details for the team.";
    }

    return errors;
}

export function BeyondBordersContactForm({
    provider = "formspree",
    endpoint = "",
    emailjsConfig = { serviceId: "", templateId: "", publicKey: "" }
}) {
    const [values, setValues] = useState(initialValues);
    const [touched, setTouched] = useState({});
    const [status, setStatus] = useState({ tone: "idle", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const errors = validate(values);

    function handleChange(event) {
        const { name, value } = event.target;
        setValues(function (current) {
            return { ...current, [name]: value };
        });
    }

    function handleBlur(event) {
        const { name } = event.target;
        setTouched(function (current) {
            return { ...current, [name]: true };
        });
    }

    async function submitWithFetch(payload) {
        if (!endpoint || /your-|change-me|example/i.test(endpoint)) {
            throw new Error("Add your Formspree or API endpoint before sending live email.");
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Unable to send your message right now.");
        }
    }

    async function submitWithEmailJs(payload) {
        if (!window.emailjs || typeof window.emailjs.send !== "function") {
            throw new Error("Load the EmailJS browser SDK before using EmailJS.");
        }

        const { serviceId, templateId, publicKey } = emailjsConfig;

        if (!serviceId || !templateId || !publicKey) {
            throw new Error("Add your EmailJS service, template, and public key.");
        }

        if (typeof window.emailjs.init === "function" && !window.emailjs.__bbInitialised) {
            window.emailjs.init(publicKey);
            window.emailjs.__bbInitialised = true;
        }

        await window.emailjs.send(serviceId, templateId, payload, publicKey);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const nextTouched = Object.keys(initialValues).reduce(function (accumulator, key) {
            accumulator[key] = true;
            return accumulator;
        }, {});
        const nextErrors = validate(values);

        setTouched(nextTouched);

        if (Object.keys(nextErrors).length > 0) {
            setStatus({ tone: "error", message: "Please correct the highlighted fields before sending." });
            return;
        }

        setIsSubmitting(true);
        setStatus({ tone: "pending", message: "Sending your message..." });

        try {
            const payload = {
                ...values,
                source: "beyond-borders-contact",
                submittedAt: new Date().toISOString()
            };

            if (provider === "emailjs") {
                await submitWithEmailJs(payload);
            } else {
                await submitWithFetch(payload);
            }

            setIsSent(true);
            setStatus({ tone: "success", message: "" });
            setValues(initialValues);
        } catch (error) {
            setStatus({
                tone: "error",
                message: error instanceof Error ? error.message : "Unable to send your message right now."
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isSent) {
        return (
            <div className="contact-form-success">
                <p className="card-kicker">Message Delivered</p>
                <h3 className="card-title">Message Sent. Your next chapter starts here.</h3>
                <p className="card-copy">
                    The Beyond Borders team now has your brief and can respond with itinerary details and next-step guidance.
                </p>
            </div>
        );
    }

    return (
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
                {[
                    ["name", "Full Name", "text", "Njeri Mwangi"],
                    ["email", "Email Address", "email", "you@example.com"],
                    ["phone", "Phone Number", "tel", "+254 7XX XXX XXX"],
                    ["travelWindow", "Preferred Travel Window", "text", "October 2026 or your preferred travel dates"]
                ].map(function ([name, label, type, placeholder]) {
                    const hasError = touched[name] && errors[name];
                    const isValid = touched[name] && !errors[name] && values[name].trim();

                    return (
                        <div className={`form-field ${hasError ? "is-invalid" : ""} ${isValid ? "is-valid" : ""}`} key={name}>
                            <label className="field-label" htmlFor={name}>{label}</label>
                            <div className="field-control">
                                <input
                                    className="field-input"
                                    id={name}
                                    name={name}
                                    type={type}
                                    value={values[name]}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder={placeholder}
                                />
                            </div>
                            <p className="field-message">{hasError ? errors[name] : ""}</p>
                        </div>
                    );
                })}

                <div className={`form-field ${touched.interest && errors.interest ? "is-invalid" : ""} ${touched.interest && !errors.interest && values.interest ? "is-valid" : ""}`}>
                    <label className="field-label" htmlFor="interest">Preferred Destination</label>
                    <div className="field-control">
                        <select className="field-input field-select" id="interest" name="interest" value={values.interest} onChange={handleChange} onBlur={handleBlur}>
                            <option value="">Select a destination</option>
                            <option value="zanzibar">Zanzibar</option>
                            <option value="safari">Kenya Road Trips</option>
                            <option value="coast">Coastal Escape</option>
                            <option value="custom">Custom Group Booking</option>
                        </select>
                    </div>
                    <p className="field-message">{touched.interest ? errors.interest || "" : ""}</p>
                </div>

                <div className={`form-field ${touched.groupSize && errors.groupSize ? "is-invalid" : ""} ${touched.groupSize && !errors.groupSize && values.groupSize ? "is-valid" : ""}`}>
                    <label className="field-label" htmlFor="groupSize">Group Size</label>
                    <div className="field-control">
                        <select className="field-input field-select" id="groupSize" name="groupSize" value={values.groupSize} onChange={handleChange} onBlur={handleBlur}>
                            <option value="">Select group size</option>
                            <option value="1-2">1-2 Guests</option>
                            <option value="3-5">3-5 Guests</option>
                            <option value="6-10">6-10 Guests</option>
                            <option value="10+">10+ Guests</option>
                        </select>
                    </div>
                    <p className="field-message">{touched.groupSize ? errors.groupSize || "" : ""}</p>
                </div>

                <div className={`form-field form-field-full ${touched.message && errors.message ? "is-invalid" : ""} ${touched.message && !errors.message && values.message.trim() ? "is-valid" : ""}`}>
                    <label className="field-label" htmlFor="message">Journey Brief</label>
                    <div className="field-control">
                        <textarea
                            className="field-input field-textarea"
                            id="message"
                            name="message"
                            rows="6"
                            value={values.message}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Tell us what kind of journey you want to build across Kenya or beyond."
                        />
                    </div>
                    <p className="field-message">{touched.message ? errors.message || "" : ""}</p>
                </div>
            </div>

            <div className="form-submit-row">
                <button className="button primary liquid-submit" type="submit" disabled={isSubmitting}>
                    <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                </button>
                <p className="form-status" data-state={status.tone}>{status.message}</p>
            </div>
        </form>
    );
}
