import { Injectable } from '@angular/core';

// @ts-ignore
import html2pdf from 'html2pdf.js';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  exportToExcel(elementId: string, filename: string = 'document') {
    const table = document.getElementById(elementId);
    if (!table) return;

    let csv = '';
    // Check if it's a standard table
    if (table.tagName === 'TABLE') {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData: string[] = [];
        cols.forEach((col, index) => {
          // Skip the last column (actions)
          if (index === cols.length - 1) return;
          
          let text = col.textContent?.trim().replace(/\s+/g, ' ').replace(/"/g, '""') || '';
          rowData.push(`"${text}"`);
        });
        csv += rowData.join(',') + '\n';
      });
    } else {
      // For divs tables (like cases)
      const rows = table.querySelectorAll('.table-row, .table-header');
      rows.forEach(row => {
        const cols = row.querySelectorAll('.col');
        const rowData: string[] = [];
        cols.forEach(col => {
          if (col.classList.contains('actions')) return;
          let text = col.textContent?.trim().replace(/\s+/g, ' ').replace(/"/g, '""') || '';
          rowData.push(`"${text}"`);
        });
        csv += rowData.join(',') + '\n';
      });
    }

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement("a");
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename + '.csv';
    downloadLink.click();
  }

  exportToPdf(elementId: string, filename: string = 'document') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Add temporary style to the document body to force colors for PDF and hide actions
    const style = document.createElement('style');
    style.id = 'pdf-print-styles';
    style.innerHTML = `
      #${elementId} { background: white !important; padding: 10px; border-radius: 0; border: none; }
      #${elementId} * { color: black !important; }
      #${elementId} th { background-color: #f1f5f9 !important; color: black !important; font-weight: bold; }
      #${elementId} td { border: 1px solid #ccc !important; }
      #${elementId} .actions, #${elementId} .action-cell, #${elementId} th:last-child, #${elementId} td:last-child { display: none !important; }
      /* For cases specific layout */
      #${elementId} .table-row, #${elementId} .table-header { border-bottom: 1px solid #ccc !important; }
      #${elementId} .tag, #${elementId} .badge { border: 1px solid #000 !important; color: #000 !important; }
    `;
    document.head.appendChild(style);

    const opt: any = {
      margin:       0.5,
      filename:     filename + '.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
      // Remove temporary styles
      const addedStyle = document.getElementById('pdf-print-styles');
      if (addedStyle) addedStyle.remove();
    });
  }
}
