import * as React from "react"
import { Slider as BaseSlider } from "@base-ui-components/react/slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof BaseSlider.Root> & { orientation?: 'horizontal' | 'vertical' }
>(({ className, orientation = "horizontal", ...props }, ref) => (
    <BaseSlider.Root
        ref={ref}
        orientation={orientation}
        className={cn(
            "relative flex touch-none select-none",
            orientation === "vertical"
                ? "flex-col h-full w-4 items-center"
                : "w-full items-center",
            className
        )}
        {...props}
    >
        <BaseSlider.Control className="relative flex w-full items-center">
            <BaseSlider.Track
                className={cn(
                    "relative grow overflow-hidden rounded-full bg-secondary",
                    orientation === "vertical" ? "w-2 h-full" : "h-2 w-full"
                )}
            >
                <BaseSlider.Indicator
                    className={cn(
                        "absolute bg-primary rounded-full",
                        orientation === "vertical" ? "w-full" : "h-full"
                    )}
                />
            </BaseSlider.Track>
            <BaseSlider.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing" />
        </BaseSlider.Control>
    </BaseSlider.Root>
))
Slider.displayName = "Slider"

export { Slider }
