import { useThemeStore } from "@/stores/theme-store";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useThemeStore();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-mac-white group-[.toaster]:text-mac-charcoal group-[.toaster]:border-2 group-[.toaster]:border-mac-charcoal group-[.toaster]:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:group-[.toaster]:bg-mac-charcoal dark:group-[.toaster]:text-mac-white dark:group-[.toaster]:border-mac-gray",
          description: "group-[.toast]:text-mac-gray-dark dark:group-[.toast]:text-mac-gray-light",
          actionButton:
            "group-[.toast]:bg-mac-charcoal group-[.toast]:text-mac-white dark:group-[.toast]:bg-mac-white dark:group-[.toast]:text-mac-charcoal",
          cancelButton:
            "group-[.toast]:bg-mac-gray group-[.toast]:text-mac-charcoal dark:group-[.toast]:bg-mac-gray-dark dark:group-[.toast]:text-mac-white",
          error: "group-[.toaster]:border-accent-red group-[.toaster]:text-accent-red",
          success: "group-[.toaster]:border-accent-green group-[.toaster]:text-accent-green",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
