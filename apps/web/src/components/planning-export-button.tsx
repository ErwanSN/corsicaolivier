'use client';

type PlanningExportButtonProps = Readonly<{
  siteName: string;
  weekStart: string;
}>;

export function PlanningExportButton({
  siteName,
  weekStart,
}: PlanningExportButtonProps) {
  const exportWeek = () => {
    const previousTitle = document.title;
    const safeSiteName = siteName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    document.title = `planning-${safeSiteName || 'zone'}-${weekStart}`;
    window.addEventListener(
      'afterprint',
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    window.print();
  };

  return (
    <button className="secondary-button" onClick={exportWeek} type="button">
      Exporter en PDF
    </button>
  );
}
