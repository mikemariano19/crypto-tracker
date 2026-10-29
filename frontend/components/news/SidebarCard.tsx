import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Sidebar panel with the same icon + title header as the dashboard cards.
 */
export default function SidebarCard({
  title,
  subtitle,
  icon,
  iconClassName,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClassName: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-72 shrink-0 border-0 shadow-sm lg:w-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>{icon}</div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
