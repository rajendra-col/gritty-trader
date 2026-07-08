import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Construction } from "lucide-react";

export default function GetLevels() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Get Levels</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center p-3 gap-2">
            <TrendingUp className="h-5  w-5" />
            Support & Resistance Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Construction className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This section will provide advanced support and resistance level analysis for your trading strategies. 
              Please continue to build out this feature by providing more specific requirements.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
