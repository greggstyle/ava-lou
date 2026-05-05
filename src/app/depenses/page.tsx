import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AvaTopBar, AvaCard, AvaPill, AvaButton, AvaLabel, C, SANS, SERIF, TNUM } from '@/components/ava';
import { formatPriceFR, formatDateRelativeFR } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface ExpenseRow {
  id: string;
  label: string;
  vendor: string | null;
  amount_ttc: number;
  category: string;
  expense_date: string;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  matériel: '#5C7CFA',
  déplacement: '#22B865',
  'sous-traitance': '#E87B3A',
  restauration: '#D6336C',
  téléphonie: '#9775FA',
  outillage: '#F59F00',
  formation: '#0CA678',
  autre: '#868E96',
};

export default async function DepensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('expenses')
    .select('id, label, vendor, amount_ttc, category, expense_date, created_at')
    .order('expense_date', { ascending: false })
    .limit(200);
  const expenses = (data ?? []) as ExpenseRow[];

  // Compute monthly totals
  let thisMonthTotal = 0;
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    if (e.expense_date >= monthStart) {
      thisMonthTotal += Number(e.amount_ttc);
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount_ttc));
    }
  }
  const sortedCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AvaTopBar
        title="Dépenses"
        right={
          <Link href="/" style={{ color: C.muted, font: `500 13px/1 ${SANS}`, textDecoration: 'none' }}>
            Accueil
          </Link>
        }
      />

      <div style={{ padding: '8px 20px 60px', flex: 1 }}>
        <h1 style={{ font: `600 26px/1.15 ${SERIF}`, color: C.ink, marginTop: 6 }}>
          Vos <em style={{ fontStyle: 'italic' }}>dépenses</em>
        </h1>

        {/* This month total */}
        <AvaCard padding={18} style={{ marginTop: 20 }}>
          <AvaLabel>Ce mois-ci</AvaLabel>
          <div style={{ font: `600 32px/1.1 ${SERIF}`, color: C.ink, marginTop: 6, ...TNUM }}>
            − {formatPriceFR(thisMonthTotal)}
          </div>
          {sortedCategories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {sortedCategories.map(([cat, total]) => (
                <div
                  key={cat}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 12,
                    background: C.soft, border: `1px solid ${C.line}`,
                    font: `500 12px/1 ${SANS}`, color: C.ink2,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: CATEGORY_COLORS[cat] ?? C.muted }} />
                  {cat} <span style={{ color: C.muted, ...TNUM }}>{formatPriceFR(total)}</span>
                </div>
              ))}
            </div>
          )}
        </AvaCard>

        {/* Recent list */}
        <div style={{ marginTop: 24 }}>
          <AvaLabel style={{ marginBottom: 10 }}>Récentes</AvaLabel>
          {expenses.length === 0 ? (
            <AvaCard padding={20}>
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted, marginBottom: 10 }}>
                Aucune dépense enregistrée. Dictez par exemple :
              </div>
              <div style={{ font: `400 14px/1.5 ${SERIF}`, color: C.ink, fontStyle: 'italic' }}>
                « J&apos;ai acheté du matériel chez Point P pour 340 € »
              </div>
            </AvaCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expenses.slice(0, 50).map((e) => (
                <AvaCard key={e.id} padding={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: CATEGORY_COLORS[e.category] ?? C.muted }} />
                        <span style={{ font: `500 11px/1 ${SANS}`, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                          {e.category}
                        </span>
                      </div>
                      <div style={{ font: `500 15px/1.3 ${SANS}`, color: C.ink }}>
                        {e.label}
                      </div>
                      {e.vendor && (
                        <div style={{ font: `400 13px/1.3 ${SANS}`, color: C.ink2, marginTop: 2 }}>
                          {e.vendor}
                        </div>
                      )}
                      <div style={{ font: `400 11px/1.3 ${SANS}`, color: C.muted, marginTop: 2 }}>
                        {formatDateRelativeFR(e.expense_date)}
                      </div>
                    </div>
                    <div style={{ font: `600 16px/1 ${SERIF}`, color: C.warn, ...TNUM, whiteSpace: 'nowrap' }}>
                      − {formatPriceFR(Number(e.amount_ttc))}
                    </div>
                  </div>
                </AvaCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
