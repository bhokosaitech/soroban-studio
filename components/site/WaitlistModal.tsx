"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

// Google Form endpoint carried over from the original landing page.
const FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSdUuVDibH2Us4bG0SPvj6y3qYuLapRsZuJnQyUuUZq7u2XCcA/formResponse";
const NAME_FIELD = "entry.2093842319";
const EMAIL_FIELD = "entry.1512200587";

export function WaitlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Hidden iframe target so the Google Form POST doesn't navigate away. */}
      <iframe
        name="waitlist_iframe"
        ref={iframeRef}
        className="hidden"
        onLoad={() => {
          if (loading) {
            setSubmitted(true);
            setLoading(false);
            setTimeout(onClose, 2500);
          }
        }}
      />
      <div
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="float-right text-muted hover:text-ink">
          <X size={18} />
        </button>

        {submitted ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check size={24} strokeWidth={3} />
            </div>
            <h2 className="font-serif text-2xl text-ink">You&apos;re on the list!</h2>
            <p className="mt-2 text-[14px] text-muted">
              Thanks for joining. We&apos;ll reach out as early access opens up.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-ink">Join the waitlist</h2>
            <p className="mt-1 mb-5 text-[14px] text-muted">
              Enter your details for early access and launch updates.
            </p>
            <form
              action={FORM_ACTION}
              method="POST"
              target="waitlist_iframe"
              onSubmit={() => setLoading(true)}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-[13px] font-medium text-ink">Name</label>
                <input name={NAME_FIELD} required placeholder="Jane Doe" className="field" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-ink">Email</label>
                <input
                  name={EMAIL_FIELD}
                  type="email"
                  required
                  placeholder="jane@example.com"
                  className="field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-dark w-full disabled:opacity-60">
                {loading ? "Joining…" : "Join waitlist"}
              </button>
            </form>
          </>
        )}
      </div>
      <style jsx>{`
        .field {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 14px;
          outline: none;
        }
        .field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-light);
        }
      `}</style>
    </div>
  );
}
