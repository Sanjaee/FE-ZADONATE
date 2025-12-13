import React, { useState, useEffect } from "react";
import { Search, Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SelectOption {
  id?: string | number;
  name: string;
  value?: string;
  code?: string;
  [key: string]: any;
}

interface SelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: SelectOption[];
  selectedValue?: string | number;
  onSelect: (option: SelectOption) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  displayValue?: string;
}

export const SelectDialog: React.FC<SelectDialogProps> = ({
  open,
  onOpenChange,
  options,
  selectedValue,
  onSelect,
  placeholder = "Select option...",
  title = "Select Option",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
  displayValue,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOptions, setFilteredOptions] =
    useState<SelectOption[]>(options);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter((option) =>
        option.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  const handleSelect = (option: SelectOption) => {
    onSelect(option);
    onOpenChange(false);
    setSearchTerm("");
  };

  const selectedOption = options.find(
    (option) =>
      option.id?.toString() === selectedValue?.toString() ||
      option.code?.toString() === selectedValue?.toString()
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-between text-left font-normal",
          !selectedOption && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={() => onOpenChange(true)}
      >
        <span className="truncate">
          {displayValue || selectedOption?.name || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No results found
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.map((option) => (
                    <button
                      key={option.id || option.code || option.name}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                        (selectedValue?.toString() === option.id?.toString() ||
                          selectedValue?.toString() ===
                            option.code?.toString()) &&
                          "bg-accent text-accent-foreground"
                      )}
                      onClick={() => handleSelect(option)}
                    >
                      <span className="truncate">{option.name}</span>
                      {(selectedValue?.toString() === option.id?.toString() ||
                        selectedValue?.toString() ===
                          option.code?.toString()) && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
