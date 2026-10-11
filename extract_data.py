import zipfile
import xml.etree.ElementTree as ET
import json
import os

def parse_xlsx():
    excel_path = 'RAW DATA.xlsx'
    if not os.path.exists(excel_path):
        print(f"File {excel_path} not found")
        return

    with zipfile.ZipFile(excel_path) as z:
        with z.open('xl/sharedStrings.xml') as f:
            ss_tree = ET.parse(f)
        strings = [elem.text if elem.text is not None else '' for elem in ss_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]

        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
        root = tree.getroot()
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = root.findall('.//ns:row', ns)

        headers = []
        for c in rows[0].findall('ns:c', ns):
            t = c.get('t')
            v = c.find('ns:v', ns)
            val = v.text if v is not None else ''
            if t == 's':
                val = strings[int(val)]
            headers.append(val)

        records = []
        for r in rows[1:]:
            row_dict = {}
            for c in r.findall('ns:c', ns):
                r_coord = c.get('r')
                col_letters = ''.join([ch for ch in r_coord if ch.isalpha()])
                col_idx = 0
                for ch in col_letters:
                    col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
                col_idx -= 1
                if col_idx < len(headers):
                    h = headers[col_idx]
                    t = c.get('t')
                    v = c.find('ns:v', ns)
                    val = v.text if v is not None else ''
                    if t == 's':
                        val = strings[int(val)]
                    row_dict[h] = val

            # Normalize numerical fields
            try:
                row_dict['tenure'] = int(float(row_dict.get('tenure', 0)))
            except:
                row_dict['tenure'] = 0

            try:
                row_dict['MonthlyCharges'] = round(float(row_dict.get('MonthlyCharges', 0)), 2)
            except:
                row_dict['MonthlyCharges'] = 0.0

            try:
                tc = row_dict.get('TotalCharges', '0').strip()
                row_dict['TotalCharges'] = round(float(tc), 2) if tc else 0.0
            except:
                row_dict['TotalCharges'] = 0.0

            records.append(row_dict)

    os.makedirs('public', exist_ok=True)
    os.makedirs('src', exist_ok=True)

    # Save full records
    with open('public/churn-data.json', 'w', encoding='utf-8') as f:
        json.dump(records, f)

    # Generate rich analytical summary
    total_customers = len(records)
    churned_customers = sum(1 for r in records if r.get('Churn') == 'Yes')
    retained_customers = total_customers - churned_customers
    churn_rate = round((churned_customers / total_customers) * 100, 2)
    avg_monthly_charges = round(sum(r['MonthlyCharges'] for r in records) / total_customers, 2)
    total_revenue = round(sum(r['TotalCharges'] for r in records), 2)

    # Churned summary metrics
    churned_records = [r for r in records if r.get('Churn') == 'Yes']

    def calc_breakdown(key):
        counts_total = {}
        counts_churn = {}
        for r in records:
            v = r.get(key, 'Unknown')
            counts_total[v] = counts_total.get(v, 0) + 1
            if r.get('Churn') == 'Yes':
                counts_churn[v] = counts_churn.get(v, 0) + 1
        return {
            v: {
                'total': counts_total[v],
                'churned': counts_churn.get(v, 0),
                'churnRate': round((counts_churn.get(v, 0) / counts_total[v]) * 100, 2)
            } for v in sorted(counts_total.keys())
        }

    # Contract breakdown
    contract_stats = calc_breakdown('Contract')
    payment_stats = calc_breakdown('PaymentMethod')
    internet_stats = calc_breakdown('InternetService')
    gender_stats = calc_breakdown('gender')
    senior_stats = calc_breakdown('SeniorCitizen')
    partner_stats = calc_breakdown('Partner')
    dependents_stats = calc_breakdown('Dependents')

    # Service adoption among churned vs all
    services = ['OnlineSecurity', 'OnlineBackup', 'DeviceProtection', 'TechSupport', 'PaperlessBilling', 'StreamingTV', 'StreamingMovies', 'PhoneService', 'MultipleLines']
    service_adoption = {}
    for s in services:
        yes_total = sum(1 for r in records if r.get(s) == 'Yes')
        yes_churn = sum(1 for r in churned_records if r.get(s) == 'Yes')
        service_adoption[s] = {
            'total_yes_pct': round((yes_total / total_customers) * 100, 1),
            'churn_yes_pct': round((yes_churn / churned_customers) * 100, 1)
        }

    # Tenure buckets (<1, 1-2, 2-3, 3-4, 4-5, 5-6 yrs)
    tenure_buckets = {'<1 yr (0-12m)': {'total': 0, 'churn': 0},
                      '1-2 yrs (13-24m)': {'total': 0, 'churn': 0},
                      '2-3 yrs (25-36m)': {'total': 0, 'churn': 0},
                      '3-4 yrs (37-48m)': {'total': 0, 'churn': 0},
                      '4-5 yrs (49-60m)': {'total': 0, 'churn': 0},
                      '5-6 yrs (61-72m)': {'total': 0, 'churn': 0}}

    for r in records:
        t = r['tenure']
        is_churn = r.get('Churn') == 'Yes'
        if t <= 12: b = '<1 yr (0-12m)'
        elif t <= 24: b = '1-2 yrs (13-24m)'
        elif t <= 36: b = '2-3 yrs (25-36m)'
        elif t <= 48: b = '3-4 yrs (37-48m)'
        elif t <= 60: b = '4-5 yrs (49-60m)'
        else: b = '5-6 yrs (61-72m)'

        tenure_buckets[b]['total'] += 1
        if is_churn:
            tenure_buckets[b]['churn'] += 1

    for b in tenure_buckets:
        tot = tenure_buckets[b]['total']
        ch = tenure_buckets[b]['churn']
        tenure_buckets[b]['churnRate'] = round((ch / tot) * 100, 2) if tot > 0 else 0

    # Monthly charges buckets (18-38, 38-58, 58-78, 78-98, 98-119)
    charge_buckets = {'$18 - $38': {'total': 0, 'churn': 0},
                      '$38 - $58': {'total': 0, 'churn': 0},
                      '$58 - $78': {'total': 0, 'churn': 0},
                      '$78 - $98': {'total': 0, 'churn': 0},
                      '$98 - $120': {'total': 0, 'churn': 0}}
    for r in records:
        mc = r['MonthlyCharges']
        is_churn = r.get('Churn') == 'Yes'
        if mc < 38: b = '$18 - $38'
        elif mc < 58: b = '$38 - $58'
        elif mc < 78: b = '$58 - $78'
        elif mc < 98: b = '$78 - $98'
        else: b = '$98 - $120'
        charge_buckets[b]['total'] += 1
        if is_churn:
            charge_buckets[b]['churn'] += 1

    for b in charge_buckets:
        tot = charge_buckets[b]['total']
        ch = charge_buckets[b]['churn']
        charge_buckets[b]['churnRate'] = round((ch / tot) * 100, 2) if tot > 0 else 0

    summary = {
        'totalCustomers': total_customers,
        'churnedCustomers': churned_customers,
        'retainedCustomers': retained_customers,
        'churnRate': churn_rate,
        'avgMonthlyCharges': avg_monthly_charges,
        'totalRevenue': total_revenue,
        'contractStats': contract_stats,
        'paymentStats': payment_stats,
        'internetStats': internet_stats,
        'genderStats': gender_stats,
        'seniorStats': senior_stats,
        'partnerStats': partner_stats,
        'dependentsStats': dependents_stats,
        'serviceAdoption': service_adoption,
        'tenureBuckets': tenure_buckets,
        'chargeBuckets': charge_buckets
    }

    with open('public/churn-summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    print("Successfully generated public/churn-data.json and public/churn-summary.json")

if __name__ == '__main__':
    parse_xlsx()
