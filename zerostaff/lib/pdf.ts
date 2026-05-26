import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { DbProposal, DbProposalItem } from '@/lib/types'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#1a1a2e', backgroundColor: '#ffffff' },
  header: { marginBottom: 32 },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#7c3aed' },
  subtitle: { fontSize: 10, color: '#6b7280', marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, color: '#111827' },
  body: { lineHeight: 1.6, color: '#374151' },
  table: { marginTop: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6 8', borderRadius: 4 },
  tableRow: { flexDirection: 'row', padding: '5 8', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  tableHeaderText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#6b7280' },
  totalRow: { flexDirection: 'row', padding: '8 8', borderTopWidth: 2, borderTopColor: '#7c3aed', marginTop: 4 },
  totalLabel: { flex: 5, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#111827' },
  totalValue: { flex: 1, fontFamily: 'Helvetica-Bold', textAlign: 'right', color: '#7c3aed' },
  acceptBlock: { marginTop: 24, padding: 16, backgroundColor: '#f5f3ff', borderRadius: 6 },
  acceptTitle: { fontFamily: 'Helvetica-Bold', color: '#7c3aed', marginBottom: 6 },
  acceptLink: { color: '#7c3aed', textDecoration: 'underline', fontSize: 9 },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9ca3af' },
})

function fmt(amount: string | number) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const CADENCE_LABELS: Record<DbProposal['billing_cadence'], string> = {
  one_off: 'One-off payment',
  monthly: 'Monthly retainer',
  quarterly: 'Quarterly billing',
}

export async function generateProposalPdf(
  proposal: DbProposal,
  items: DbProposalItem[],
  acceptUrl: string,
): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    { title: proposal.title },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },

      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.brand }, 'ZeroStaff'),
        React.createElement(Text, { style: styles.subtitle }, 'AI-Powered Content Agency'),
      ),

      React.createElement(View, { style: styles.divider }),

      // Proposal title + client
      React.createElement(Text, { style: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 } }, proposal.title),
      React.createElement(Text, { style: { fontSize: 10, color: '#6b7280', marginBottom: 20 } },
        `Prepared for ${proposal.client_name} <${proposal.client_email}>`
      ),

      // Executive summary
      proposal.executive_summary
        ? React.createElement(
            View,
            { style: { marginBottom: 20 } },
            React.createElement(Text, { style: styles.sectionTitle }, 'Overview'),
            React.createElement(Text, { style: styles.body }, proposal.executive_summary),
          )
        : null,

      // Services table
      React.createElement(
        View,
        { style: { marginBottom: 20 } },
        React.createElement(Text, { style: styles.sectionTitle }, 'Services'),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.tableHeaderText, styles.colDesc] }, 'Description'),
          React.createElement(Text, { style: [styles.tableHeaderText, styles.colQty] }, 'Qty'),
          React.createElement(Text, { style: [styles.tableHeaderText, styles.colPrice] }, 'Unit Price'),
          React.createElement(Text, { style: [styles.tableHeaderText, styles.colTotal] }, 'Total'),
        ),
        ...items.map(item =>
          React.createElement(
            View,
            { key: item.id, style: styles.tableRow },
            React.createElement(Text, { style: styles.colDesc }, item.description),
            React.createElement(Text, { style: styles.colQty }, String(item.quantity)),
            React.createElement(Text, { style: styles.colPrice }, fmt(item.unit_price)),
            React.createElement(Text, { style: styles.colTotal }, fmt(item.total)),
          )
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Total'),
          React.createElement(Text, { style: styles.totalValue }, fmt(proposal.total_amount)),
        ),
        React.createElement(
          Text,
          { style: { fontSize: 9, color: '#6b7280', marginTop: 6 } },
          CADENCE_LABELS[proposal.billing_cadence],
        ),
      ),

      // Timeline
      proposal.timeline_notes
        ? React.createElement(
            View,
            { style: { marginBottom: 20 } },
            React.createElement(Text, { style: styles.sectionTitle }, 'Timeline'),
            React.createElement(Text, { style: styles.body }, proposal.timeline_notes),
          )
        : null,

      // Accept block
      React.createElement(
        View,
        { style: styles.acceptBlock },
        React.createElement(Text, { style: styles.acceptTitle }, 'Accept this Proposal'),
        React.createElement(
          Text,
          { style: { fontSize: 9, color: '#374151', marginBottom: 8, lineHeight: 1.5 } },
          'Click the link below to accept this proposal digitally. Your acceptance will be recorded with a timestamp and your IP address.',
        ),
        React.createElement(Text, { style: styles.acceptLink }, acceptUrl),
      ),

      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.footerText }, `Generated ${new Date().toLocaleDateString()}`),
        React.createElement(Text, { style: styles.footerText }, 'ZeroStaff — AI Automation Agency'),
      ),
    ),
  )

  return renderToBuffer(doc)
}
