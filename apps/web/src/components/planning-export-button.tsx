'use client';

type PlanningExportButtonProps = Readonly<{
  draftVersionNumber?: number;
  siteName: string;
  weekStart: string;
}>;

function safeExportName(
  siteName: string,
  weekStart: string,
  draftVersionNumber?: number,
): string {
  const safeSiteName = siteName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `planning-${safeSiteName || 'zone'}-${weekStart}${
    draftVersionNumber ? `-brouillon-v${draftVersionNumber}` : ''
  }`;
}

function readableStyles(): string {
  return Array.from(document.styleSheets)
    .flatMap((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules, (rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join('\n');
}

export function PlanningExportButton({
  draftVersionNumber,
  siteName,
  weekStart,
}: PlanningExportButtonProps) {
  const exportPdf = () => {
    const previousTitle = document.title;

    document.title = safeExportName(siteName, weekStart, draftVersionNumber);
    window.addEventListener(
      'afterprint',
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    window.print();
  };

  const exportSvg = () => {
    const planning = document.querySelector<HTMLElement>(
      '.planning-print-root',
    );
    const visibleGrid = planning?.querySelector<HTMLElement>(
      '[data-planning-week-row]',
    );

    if (!planning || !visibleGrid) return;

    const width = Math.max(1320, Math.ceil(visibleGrid.scrollWidth) + 48);
    const clone = planning.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('[data-print-hide], [data-svg-hide]')
      .forEach((element) => element.remove());
    clone
      .querySelectorAll<HTMLElement>('.planning-print-only')
      .forEach((element) => {
        element.style.display = 'block';
      });
    clone.style.boxSizing = 'border-box';
    clone.style.width = `${width}px`;
    clone.style.padding = '24px';

    const exportStyles = document.createElement('style');
    exportStyles.textContent = `${readableStyles()}
      [data-svg-export] {
        width: ${width}px;
        background: #ffffff;
        color: #000000;
      }
      [data-svg-export] [data-planning-week-viewport] {
        overflow: visible !important;
        max-height: none !important;
      }
      [data-svg-export] [data-planning-week-row] {
        width: 100% !important;
        min-width: 0 !important;
        grid-template-columns: 12rem repeat(7, minmax(0, 1fr)) !important;
      }
      [data-svg-export] [data-planning-week-row] > * {
        position: static !important;
      }
      [data-svg-export] button {
        cursor: default !important;
      }
      [data-svg-export] [data-search-state] {
        opacity: 1 !important;
        box-shadow: none !important;
      }`;

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-svg-export', '');
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrapper.append(exportStyles, clone);

    const staging = document.createElement('div');
    staging.style.position = 'fixed';
    staging.style.left = '-100000px';
    staging.style.top = '0';
    staging.style.width = `${width}px`;
    staging.style.background = '#ffffff';
    staging.append(wrapper);
    document.body.append(staging);

    const height = Math.max(
      1,
      Math.ceil(wrapper.getBoundingClientRect().height),
    );
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const foreignObject = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'foreignObject',
    );
    foreignObject.setAttribute('width', '100%');
    foreignObject.setAttribute('height', '100%');
    foreignObject.append(wrapper);
    svg.append(foreignObject);
    staging.remove();

    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${safeExportName(
      siteName,
      weekStart,
      draftVersionNumber,
    )}.svg`;
    link.href = url;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <>
      <button className="secondary-button" onClick={exportPdf} type="button">
        {draftVersionNumber
          ? 'Exporter le brouillon en PDF'
          : 'Exporter en PDF'}
      </button>
      <button className="secondary-button" onClick={exportSvg} type="button">
        {draftVersionNumber
          ? 'Exporter le brouillon en SVG'
          : 'Exporter en SVG'}
      </button>
    </>
  );
}
