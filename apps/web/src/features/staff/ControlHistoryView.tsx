import { recentControls } from "./control-history";
import { ControlHistoryItem } from "./ControlHistoryItem";

export function ControlHistoryView() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Historique des contrôles</h1>
      <p className="mt-1 text-[14px] text-muted">{recentControls.length} contrôles enregistrés</p>

      <div className="mt-5 flex flex-col gap-2.5">
        {recentControls.map((control) => (
          <ControlHistoryItem control={control} key={control.id} />
        ))}
      </div>
    </div>
  );
}
