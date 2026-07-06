import { useState } from 'react';
import { Button, InlineLoading } from '@carbon/react';
import { Printer, Download } from '@carbon/icons-react';
import { printService } from '../../services/print.service';
import type { Examination } from '../../types';

interface PrintButtonProps {
  examination: Examination;
}

/**
 * Renders "Download PDF" and "Print" action buttons for an examination.
 * Both actions are client-side only — no server call for PDF rendering.
 */
export default function PrintButton({ examination }: PrintButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await printService.downloadPdf(examination);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printService.printExamination(examination);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <>
      {isDownloading ? (
        <InlineLoading description="Generating PDF…" status="active" />
      ) : (
        <Button
          kind="ghost"
          renderIcon={Download}
          onClick={handleDownload}
          aria-label="Download PDF report for this examination"
        >
          Download PDF
        </Button>
      )}

      {isPrinting ? (
        <InlineLoading description="Opening print dialog…" status="active" />
      ) : (
        <Button
          kind="ghost"
          renderIcon={Printer}
          onClick={handlePrint}
          aria-label="Print report for this examination"
        >
          Print
        </Button>
      )}
    </>
  );
}

// Made with Bob
