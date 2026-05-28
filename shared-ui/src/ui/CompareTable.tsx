'use client'

/**
 * CompareTable — competitive comparison table.
 * Driven by data, no hardcoded competitors.
 * Accent colour from CSS var(--accent) automatically.
 *
 * Usage:
 *   import { CompareTable } from '@infosiva/shared-ui'
 *
 *   <CompareTable
 *     ourName="ResumeVault"
 *     features={[
 *       { name: 'ATS scan',         us: true,   them: ['Paid only','Paid only','No'] },
 *       { name: 'Free PDF export',  us: true,   them: ['No','$3/mo','No'] },
 *       { name: 'Price',            us: 'Free', them: ['$20/mo','$9/mo','$15/mo'] },
 *     ]}
 *     competitors={['Zety','Resume.io','Kickresume']}
 *   />
 */

import { Check, X, Minus } from 'lucide-react'

export interface CompareFeature {
  name: string
  /** Our value: true = ✓, false = ✗, string = custom label */
  us: boolean | string
  /** Their values (one per competitor entry) */
  them: (boolean | string)[]
}

export interface CompareTableProps {
  ourName: string
  features: CompareFeature[]
  competitors: string[]
  /** Section heading. Default: 'How we compare' */
  heading?: string
  /** Subheading */
  sub?: string
  /** Accent colour. Default: uses CSS var(--accent) */
  accentColor?: string
}

function Cell({ val, ours, accent }: { val: boolean | string; ours?: boolean; accent: string }) {
  if (val === true)  return <span style={{ color: ours ? accent : '#4ade80' }}><Check style={{ width: 16, height: 16, display: 'inline' }} /></span>
  if (val === false) return <span style={{ color: 'rgba(255,255,255,0.2)' }}><X style={{ width: 16, height: 16, display: 'inline' }} /></span>
  if (val === '-')   return <span style={{ color: 'rgba(255,255,255,0.2)' }}><Minus style={{ width: 16, height: 16, display: 'inline' }} /></span>
  return <span style={{ fontSize: 13, fontWeight: ours ? 700 : 400, color: ours ? '#fff' : 'rgba(255,255,255,0.4)' }}>{String(val)}</span>
}

export function CompareTable({
  ourName,
  features,
  competitors,
  heading = 'How we compare',
  sub,
  accentColor = 'var(--accent)',
}: CompareTableProps) {
  return (
    <section style={{ padding: '4rem 1rem', position: 'relative' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)', fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            {heading}
          </h2>
          {sub && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>{sub}</p>}
        </div>

        {/* Table wrapper */}
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{
                  padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700,
                  color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}>
                  Feature
                </th>
                {/* Our column — highlighted */}
                <th style={{
                  padding: '14px 16px', textAlign: 'center', fontSize: 13, fontWeight: 900,
                  color: '#fff', background: `rgba(${accentColor === 'var(--accent)' ? '245,158,11' : '0,0,0'},0.12)`,
                  borderBottom: `2px solid ${accentColor}`,
                  minWidth: 120,
                }}>
                  <span style={{ color: accentColor }}>{ourName}</span>
                </th>
                {competitors.map(c => (
                  <th key={c} style={{
                    padding: '14px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.02)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)', minWidth: 100,
                  }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.name} style={{ borderBottom: i < features.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                    {f.name}
                  </td>
                  <td style={{
                    padding: '13px 16px', textAlign: 'center',
                    background: `rgba(${accentColor === 'var(--accent)' ? '255,255,255' : '0,0,0'},0.02)`,
                  }}>
                    <Cell val={f.us} ours accent={String(accentColor)} />
                  </td>
                  {f.them.map((v, j) => (
                    <td key={j} style={{ padding: '13px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                      <Cell val={v} accent={String(accentColor)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 11, marginTop: 16 }}>
          Pricing and features based on publicly available information. Verify at each provider's site.
        </p>
      </div>
    </section>
  )
}
