import { Search } from "lucide-react";

export type SearchFieldProps = Readonly<{
  helper?: string;
  inputMode?: "tel" | "text";
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}>;

export function SearchField({
  helper,
  inputMode = "text",
  label,
  onChange,
  placeholder,
  value
}: SearchFieldProps) {
  return (
    <label className="block">
      <span className="block text-[15px] font-medium text-foreground">{label}</span>
      <span className="mt-3 flex items-center gap-2 rounded-2xl bg-foreground/5 px-4 py-3.5">
        <Search className="size-5 shrink-0 text-muted" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted"
          inputMode={inputMode}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          type="search"
          value={value}
        />
      </span>
      {helper ? <span className="mt-2 block text-[12px] text-muted">{helper}</span> : null}
    </label>
  );
}
