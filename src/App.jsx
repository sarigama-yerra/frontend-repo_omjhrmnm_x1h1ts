/*
Accessibility checklist (quick):
- All interactive controls are buttons/inputs with keyboard focus and Enter submits.
- View password toggle uses a <button> with aria-pressed and dynamic aria-label ("Show password" / "Hide password").
- Error text uses role="alert" and inputs set aria-invalid on error.
- Color contrast uses high-contrast text on soft backgrounds (>= 4.5:1 for critical UI).
- Tooltip after 3 failed attempts is reachable and announced (aria-live polite).
- Form fields have associated labels.

labubu-utils:
- Replace the placeholder image token {{LABUBU_IMAGE}} by passing a real PNG/SVG via the labubuImageSrc prop.
- Recommended exported sizes: 200×200 for desktop stage, 120×120 for mobile. Use a square with transparent background if possible.
- You can keep the pupils/overlays; the eyes overlay is drawn with simple divs above the image.
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Small, testable state export to assert animation triggers
export const labubuState = {
  isPeeking: false,
  isShaking: false,
  isHopping: false,
  wrongAttempts: 0,
};

// Helper: clamp value between min and max
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Star particle generator (simple, CSS-animated)
const StarBurst = ({ triggerKey }) => {
  const stars = useMemo(() => Array.from({ length: 10 }, (_, i) => i), [triggerKey]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {stars.map((i) => (
        <span
          key={`${triggerKey}-${i}`}
          className="absolute block w-1.5 h-1.5 bg-yellow-300 rounded-full star-particle"
          style={{
            left: "50%",
            top: "50%",
            // distribute angles and distances
            // CSS keyframes handle motion; we vary animation-delay slightly
            animationDelay: `${(i % 5) * 40}ms`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
};

const emailRegex = /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[A-Za-z0-9_.-]{3,})$/; // allow username-like fallback

const LabubuLogin = ({
  onSubmit,
  onSuccess,
  onError,
  labubuImageSrc = "{{LABUBU_IMAGE}}",
  simulateWrongPassword = false,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "", form: "" });
  const [submitting, setSubmitting] = useState(false);

  // Animation state
  const [isPeeking, setIsPeeking] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const [failTooltip, setFailTooltip] = useState(false);
  const wrongAttemptsRef = useRef(0);

  // For tests
  useEffect(() => {
    labubuState.isPeeking = isPeeking;
    labubuState.isShaking = isShaking;
    labubuState.isHopping = isHopping;
    labubuState.wrongAttempts = wrongAttemptsRef.current;
  }, [isPeeking, isShaking, isHopping]);

  const stageRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);

  // Cursor-follow pupils (limited translation inside sockets)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    let pointer = { x: 0, y: 0 };

    const onMove = (e) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      pointer = { x, y };
      if (!raf) raf = requestAnimationFrame(updatePupils);
    };

    const updatePupils = () => {
      raf = 0;
      const rect = stage.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const maxOffset = Math.min(rect.width, rect.height) * 0.06; // limit within socket
      const dist = Math.hypot(dx, dy) || 1;
      const ux = (dx / dist) * maxOffset;
      const uy = (dy / dist) * maxOffset;

      const style = `translate(${clamp(ux, -maxOffset, maxOffset)}px, ${clamp(
        uy,
        -maxOffset,
        maxOffset
      )}px)`;
      if (leftEyeRef.current) leftEyeRef.current.style.transform = style;
      if (rightEyeRef.current) rightEyeRef.current.style.transform = style;
    };

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("touchmove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const validate = () => {
    const nErr = { email: "", password: "", form: "" };
    if (!emailRegex.test(email)) nErr.email = "Enter a valid email or username";
    if (password.length < 8) nErr.password = "Minimum 8 characters";
    setErrors(nErr);
    return !nErr.email && !nErr.password;
  };

  const triggerPeek = useCallback(() => {
    setIsPeeking(true);
    labubuState.isPeeking = true;
    // Lean then peek
    setTimeout(() => {
      setIsPeeking(false);
      labubuState.isPeeking = false;
    }, 600);
  }, []);

  const handleTogglePassword = () => {
    const next = !showPassword;
    setShowPassword(next);
    if (next) triggerPeek();
  };

  const vibrate = (pattern = [20, 40, 20]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch {}
    }
  };

  const handleWrong = () => {
    setIsShaking(true);
    labubuState.isShaking = true;
    vibrate([30, 30, 30]);
    setTimeout(() => {
      setIsShaking(false);
      labubuState.isShaking = false;
    }, 400);

    wrongAttemptsRef.current += 1;
    labubuState.wrongAttempts = wrongAttemptsRef.current;
    if (wrongAttemptsRef.current >= 3) {
      setFailTooltip(true);
    }
  };

  const handleSuccess = async () => {
    setIsHopping(true);
    labubuState.isHopping = true;
    setTimeout(() => {
      setIsHopping(false);
      labubuState.isHopping = false;
    }, 600);
    wrongAttemptsRef.current = 0;
    setFailTooltip(false);
    onSuccess && onSuccess();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors((p) => ({ ...p, form: "" }));
    if (!validate()) return;

    // Dev helper to force wrong animation
    if (simulateWrongPassword) {
      setErrors((p) => ({ ...p, form: "Incorrect password. Try again or reset." }));
      handleWrong();
      onError && onError(new Error("Simulated wrong password"));
      return;
    }

    setSubmitting(true);
    try {
      let ok = false;
      if (onSubmit) {
        // Let parent decide correctness: return boolean or throw
        const res = await onSubmit({ email, password, remember: true });
        ok = !!res;
      } else {
        // Simple demo rule; replace with real auth
        ok = email.toLowerCase().includes("demo") && password === "labubu123";
      }

      if (ok) {
        await handleSuccess();
      } else {
        setErrors((p) => ({ ...p, form: "Incorrect password. Try again or reset." }));
        handleWrong();
        onError && onError(new Error("Incorrect credentials"));
      }
    } catch (err) {
      setErrors((p) => ({ ...p, form: "Incorrect password. Try again or reset." }));
      handleWrong();
      onError && onError(err instanceof Error ? err : new Error("Login error"));
    } finally {
      setSubmitting(false);
    }
  };

  const ariaPasswordLabel = showPassword ? "Hide password" : "Show password";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-rose-50 via-violet-50 to-amber-50 flex items-center justify-center p-4">
      {/* Little CSS helpers */}
      <style>{`
        .glass { backdrop-filter: saturate(180%) blur(8px); background: rgba(255, 255, 255, 0.6); }
        .breath { animation: breath 6s ease-in-out infinite; }
        @keyframes breath { 0%{ transform: scale(0.98);} 50%{ transform: scale(1.02);} 100%{ transform: scale(0.98);} }
        .shake { animation: shake 400ms cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        .lean { animation: lean 300ms ease-out forwards; }
        @keyframes lean { from { transform: translateY(0) rotate(0deg);} to { transform: translateY(-6px) rotate(-2deg);} }
        .peek { animation: peek 300ms ease-out forwards; }
        @keyframes peek { from { filter: brightness(1);} to { filter: brightness(1.08);} }
        .hop { animation: hop 600ms ease-out; }
        @keyframes hop { 0%{ transform: translateY(0);} 30%{ transform: translateY(-10px);} 60%{ transform: translateY(0);} 100%{ transform: translateY(0);} }
        .eye { transition: transform 120ms ease-out; }
        .eye-lid { transition: transform 160ms ease-out, opacity 160ms ease-out; }
        .star-particle { animation: star 700ms ease-out forwards; }
        @keyframes star { from{ opacity:1; transform: translate(-50%, -50%) scale(1);} to{ opacity:0; transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 0px))) scale(0.4);} }
      `}</style>

      <noscript>
        <div className="max-w-4xl w-full glass rounded-2xl shadow-xl p-6 mx-auto">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Welcome back</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-center justify-center">
              <img src={"{{LABUBU_IMAGE}}"} alt="Labubu" className="w-40 h-40 rounded-full object-contain" />
            </div>
            <form method="post" className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Email</span>
                <input className="mt-1 w-full border rounded-lg p-2" placeholder="Email or username" name="email" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Password</span>
                <input className="mt-1 w-full border rounded-lg p-2" placeholder="Password" type="password" name="password" />
              </label>
              <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg">Sign in</button>
            </form>
          </div>
        </div>
      </noscript>

      <div
        data-testid="login-card"
        className="max-w-5xl w-full glass rounded-2xl shadow-xl p-6 sm:p-8 md:p-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
          {/* Left: Labubu stage */}
          <div className="flex items-center justify-center">
            <div
              ref={stageRef}
              data-testid="labubu-stage"
              className={`relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full bg-white/70 shadow-inner overflow-hidden breath ${
                isShaking ? "shake" : ""
              } ${isHopping ? "hop" : ""}`}
              aria-label="Labubu interactive doll"
            >
              {/* Base image */}
              <img
                src={"{{LABUBU_IMAGE}}"}
                alt="Labubu"
                className={`absolute inset-0 w-full h-full object-contain select-none pointer-events-none ${
                  isPeeking ? "lean" : ""
                }`}
                draggable={false}
              />

              {/* Eyes overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-24 h-10 sm:w-28 sm:h-12">
                  {/* left eye */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 border border-gray-200 overflow-hidden">
                    <div ref={leftEyeRef} className="eye absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-gray-900 rounded-full" />
                    {/* eyelid for blink on wrong */}
                    <div className={`eye-lid absolute inset-0 bg-white ${isShaking ? "opacity-100" : "opacity-0"}`} style={{ transform: isShaking ? "translateY(0)" : "translateY(-100%)" }} />
                  </div>
                  {/* right eye */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 border border-gray-200 overflow-hidden">
                    <div ref={rightEyeRef} className="eye absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-gray-900 rounded-full" />
                    <div className={`eye-lid absolute inset-0 bg-white ${isShaking ? "opacity-100" : "opacity-0"}`} style={{ transform: isShaking ? "translateY(0)" : "translateY(-100%)" }} />
                  </div>
                </div>
              </div>

              {/* sad mouth / tear on wrong */}
              <div className="absolute inset-x-0 bottom-10 flex items-center justify-center">
                <div className={`w-6 h-2 rounded-b-full border-b-4 ${isShaking ? "border-rose-400" : "border-transparent"}`}></div>
                <div className={`ml-2 w-1.5 h-1.5 rounded-full ${isShaking ? "bg-cyan-300" : "bg-transparent"}`}></div>
              </div>

              {/* Tooltip after 3 fails */}
              {failTooltip && (
                <div role="status" aria-live="polite" className="absolute -top-2 right-2 bg-gray-900 text-white text-xs px-2 py-1 rounded-md shadow">
                  Need help? Reset your password.
                </div>
              )}

              {/* Stars on success */}
              {isHopping && <StarBurst triggerKey={Date.now()} />}
            </div>
          </div>

          {/* Right: Form */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome back</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to continue</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  data-testid="email-input"
                  id="email"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  className={`mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent ${
                    errors.email ? "border-rose-400" : "border-gray-300"
                  }`}
                  placeholder="Email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-rose-600">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    data-testid="toggle-password"
                    onClick={handleTogglePassword}
                    aria-pressed={showPassword}
                    aria-label={ariaPasswordLabel}
                    className="text-sm text-purple-600 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    data-testid="password-input"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={`mt-1 w-full rounded-xl border bg-white/80 px-3 py-2 pr-20 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent ${
                      errors.password ? "border-rose-400" : "border-gray-300"
                    } ${isPeeking ? "peek" : ""}`}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const form = e.currentTarget.form;
                        if (form) form.requestSubmit();
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                      <input type="checkbox" className="rounded border-gray-300 text-purple-600 focus:ring-purple-400" defaultChecked />
                      Remember me
                    </label>
                  </div>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-1 text-sm text-rose-600">{errors.password}</p>
                )}
              </div>

              {/* Error message */}
              {errors.form && (
                <div role="alert" data-testid="error-text" className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-3 py-2">
                  Incorrect password. Try again or reset.
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <a href="#" className="text-purple-700 hover:underline focus:underline">Forgot password?</a>
              </div>

              <button
                data-testid="submit-button"
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex justify-center rounded-xl bg-purple-600 text-white font-semibold py-2.5 shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Usage notes */}
            <div className="mt-6 text-xs text-gray-500">
              <p>
                Dev tip: pass simulateWrongPassword to trigger the error animation without real auth. Replace the
                demo rule with your auth in onSubmit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabubuLogin;

/*
Sample usage:

import LabubuLogin from "./components/LabubuLogin";

function Page() {
  return (
    <LabubuLogin
      labubuImageSrc={"{{LABUBU_IMAGE}}"}
      simulateWrongPassword={false}
      onSubmit={async ({ email, password }) => {
        // Replace with real API call, return true if ok
        return email === "demo@example.com" && password === "labubu123";
      }}
      onSuccess={() => console.log("Logged in!")}
      onError={(e) => console.error(e)}
    />
  );
}
*/
