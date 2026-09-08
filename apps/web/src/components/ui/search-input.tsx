"use client";

import { useImperativeHandle, useRef, type ComponentProps } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { cn } from "cn";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import styles from "./search-input.module.css";

function SearchField({
  className,
  children,
  size = "default",
  ...props
}: ComponentProps<"div"> & { size?: "default" | "lg" }) {
  return (
    <div
      data-slot="search-field"
      data-size={size}
      className={cn(styles.field, className)}
      {...props}
    >
      <Search aria-hidden="true" className={styles.icon} />
      {children}
    </div>
  );
}

type SearchInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "size" | "type" | "children" | "aria-label"
> & {
  label: string;
  clearLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "lg";
};

function SearchInput({
  ref,
  className,
  label,
  clearLabel,
  value,
  onValueChange,
  size = "default",
  placeholder = label,
  disabled,
  readOnly,
  ...props
}: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current!, []);

  return (
    <SearchField className={className} size={size} data-disabled={disabled || undefined}>
      <Input
        {...props}
        ref={input}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        className={styles.input}
      />
      {value && !readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.action}
          aria-label={clearLabel}
          disabled={disabled}
          onClick={() => {
            onValueChange("");
            input.current?.focus();
          }}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </SearchField>
  );
}

function SearchComboboxInput({
  toggleLabel,
  ...props
}: Omit<Combobox.Input.Props, "className" | "render" | "size"> & {
  toggleLabel: string;
}) {
  return (
    <Combobox.InputGroup render={<SearchField size="lg" />}>
      <Combobox.Input {...props} className={styles.input} />
      <Combobox.Trigger
        aria-label={toggleLabel}
        render={<Button variant="ghost" size="icon" className={styles.action} />}
      >
        <ChevronDown aria-hidden="true" />
      </Combobox.Trigger>
    </Combobox.InputGroup>
  );
}

export { SearchInput, SearchComboboxInput };
