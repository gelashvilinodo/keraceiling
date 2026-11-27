import prices from '../data/prices.json';
import { whatsappLink } from '../data/site';

type Room = { l: number; w: number; materialId: string; finishId: string; profileId: string; bathroom: boolean };

const fmt = new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 1 });
const cur = prices.currency;
const money = (n: number) => `${fmt.format(n)} ${cur}`;
const roundTo = (n: number, step = 10) => Math.round(n / step) * step;
const num = (el: HTMLInputElement | null) => Math.max(0, parseFloat(el?.value.replace(',', '.') ?? '') || 0);

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id) ?? list[0];
const bathBaseRate = byId(prices.material, prices.bathroom.baseMaterialId).pricePerM2;

/** ოთახის ფასი: ტილო (აბაზანაზე — ფიქსირებული 10 მ²-მდე) + პროფილი პერიმეტრზე. პროფილი ცალკე არ ჩანს. */
export function roomCost(r: Room, replace: boolean) {
  const area = r.l * r.w;
  const perim = 2 * (r.l + r.w);
  const rate = byId(prices.material, r.materialId).pricePerM2 * (replace ? prices.replace.factor : 1);
  const { includedM2, basePrice } = prices.bathroom;
  const canvas = r.bathroom
    ? (basePrice * rate) / bathBaseRate + Math.max(0, area - includedM2) * rate
    : area * rate;
  return { area, perim, cost: canvas + perim * byId(prices.profile, r.profileId).pricePerM };
}

export function initCalculator() {
  const root = document.querySelector<HTMLFormElement>('[data-calc]');
  const tpl = document.querySelector<HTMLTemplateElement>('[data-room-tpl]');
  if (!root || !tpl) return;

  const roomsEl = root.querySelector<HTMLElement>('[data-rooms]')!;
  const totalEl = root.querySelector<HTMLElement>('[data-total]')!;
  const metaEl = root.querySelector<HTMLElement>('[data-meta]')!;
  const breakdownEl = root.querySelector<HTMLElement>('[data-breakdown]')!;
  const waEl = root.querySelector<HTMLAnchorElement>('[data-wa]')!;
  const replaceEl = root.querySelector<HTMLInputElement>('[data-replace]')!;

  const addRoom = () => {
    roomsEl.append(tpl.content.cloneNode(true));
    renumber();
    update();
  };

  const renumber = () => {
    const rooms = roomsEl.querySelectorAll<HTMLElement>('[data-room]');
    rooms.forEach((r, i) => {
      r.querySelector('[data-room-num]')!.textContent = String(i + 1);
      r.querySelector<HTMLButtonElement>('[data-remove-room]')!.hidden = rooms.length === 1;
    });
  };

  const readRooms = (): Room[] =>
    [...roomsEl.querySelectorAll<HTMLElement>('[data-room]')].map((r) => ({
      l: num(r.querySelector('[data-l]')),
      w: num(r.querySelector('[data-w]')),
      materialId: r.querySelector<HTMLSelectElement>('[data-material]')!.value,
      finishId: r.querySelector<HTMLSelectElement>('[data-finish]')!.value,
      profileId: r.querySelector<HTMLSelectElement>('[data-profile]')!.value,
      bathroom: r.querySelector<HTMLInputElement>('[data-bath]')!.checked,
    }));

  function update() {
    const rooms = readRooms();
    const replace = replaceEl.checked;
    const lines: { label: string; value: number }[] = [];
    const msg: string[] = ['გამარჯობა! გამოვთვალე ფასი საიტზე:', ''];
    let total = 0;
    let totalArea = 0;

    roomsEl.querySelectorAll<HTMLElement>('[data-room]').forEach((el, i) => {
      const r = rooms[i];
      const { area, perim, cost } = roomCost(r, replace);
      const material = byId(prices.material, r.materialId);
      const finish = byId(prices.finish, r.finishId);
      const profile = byId(prices.profile, r.profileId);
      const name = r.bathroom ? 'აბაზანა' : `ოთახი ${i + 1}`;

      el.querySelector('[data-area]')!.textContent = fmt1.format(area);
      el.querySelector('[data-perim]')!.textContent = fmt1.format(perim);

      total += cost;
      totalArea += area;
      lines.push({ label: `${name} · ${fmt1.format(area)} მ² · ${material.label}, ${finish.label}`, value: cost });
      msg.push(
        `${name}: ${r.l}×${r.w} მ (${fmt1.format(area)} მ²), ${material.label}, ${finish.label}, პროფილი: ${profile.label}`,
      );
    });

    prices.extras.forEach((x) => {
      const qty = num(root.querySelector(`[data-extra="${x.id}"]`));
      if (!qty) return;
      const cost = qty * x.price;
      total += cost;
      lines.push({ label: `${x.label} × ${fmt1.format(qty)} ${x.unit}`, value: cost });
      msg.push(`${x.label}: ${fmt1.format(qty)} ${x.unit}`);
    });
    if (replace) msg.push(prices.replace.label);

    const minApplied = total > 0 && total < prices.minOrder;
    if (minApplied) total = prices.minOrder;

    if (totalArea <= 0) {
      totalEl.textContent = '—';
      metaEl.textContent = 'შეიყვანეთ ოთახის ზომები';
    } else {
      const lo = Math.max(prices.minOrder, roundTo(total * prices.range.low));
      const hi = Math.max(lo, roundTo(total * prices.range.high));
      totalEl.textContent = `${fmt.format(lo)} – ${fmt.format(hi)} ${cur}`;
      metaEl.textContent = `სულ ${fmt1.format(totalArea)} მ²${minApplied ? ` · მინიმალური შეკვეთა ${money(prices.minOrder)}` : ''}`;
      msg.push('', `სავარაუდო ფასი: ${fmt.format(lo)} – ${fmt.format(hi)} ${cur}`, '', 'მინდა უფასო კონსულტაცია.');
    }

    breakdownEl.replaceChildren(
      ...lines.map((l) => {
        const li = document.createElement('li');
        const a = document.createElement('span');
        const b = document.createElement('span');
        a.textContent = l.label;
        b.textContent = money(l.value);
        li.append(a, b);
        return li;
      }),
    );

    waEl.href = whatsappLink(msg.join('\n'));
  }

  root.addEventListener('input', update);
  root.addEventListener('change', update);
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;

    if (t.closest('[data-add-room]')) return addRoom();

    const remove = t.closest('[data-remove-room]');
    if (remove) {
      remove.closest('[data-room]')?.remove();
      renumber();
      return update();
    }

    const stepBtn = t.closest<HTMLButtonElement>('[data-step]');
    if (stepBtn) {
      const input = stepBtn.parentElement!.querySelector<HTMLInputElement>('input')!;
      const step = parseFloat(input.step) || 1;
      const next = num(input) + step * Number(stepBtn.dataset.step);
      input.value = String(Math.max(0, Math.round(next * 100) / 100));
      update();
    }
  });

  addRoom();
}
