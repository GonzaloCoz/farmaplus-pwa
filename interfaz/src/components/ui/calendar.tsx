import {
  Calendar as FluidCalendar,
  type CalendarProps as FluidCalendarProps,
} from "@/components/ui/fluid-calendar";

export type CalendarProps = FluidCalendarProps & {
  /** Backwards-compatible alias for `autoFocus`. */
  initialFocus?: boolean;
};

function Calendar({ initialFocus, autoFocus, ...props }: CalendarProps) {
  return <FluidCalendar autoFocus={autoFocus ?? initialFocus} {...props} />;
}
Calendar.displayName = "Calendar";

export { Calendar };

