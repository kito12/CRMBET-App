"use client";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

const fieldBase =
  "w-full px-4 py-2.5 rounded-xl text-sm text-[#1a1c1c] outline-none transition-all focus:ring-2 focus:ring-purple-200 placeholder:text-[#48484a]";

export function InputField({ label, ...props }: InputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide">{label}</label>
      <input
        className={fieldBase}
        style={{ background: "var(--surface-low)" }}
        onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
        onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
        {...props}
      />
    </div>
  );
}

export function SelectField({ label, children, ...props }: SelectProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide">{label}</label>
      <select
        className={fieldBase}
        style={{ background: "var(--surface-low)" }}
        onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
        onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export function TextareaField({ label, ...props }: TextareaProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#48484a] mb-1.5 uppercase tracking-wide">{label}</label>
      <textarea
        rows={3}
        className={`${fieldBase} resize-none`}
        style={{ background: "var(--surface-low)" }}
        onFocus={(e) => (e.target.style.background = "var(--surface-lowest)")}
        onBlur={(e) => (e.target.style.background = "var(--surface-low)")}
        {...props}
      />
    </div>
  );
}
