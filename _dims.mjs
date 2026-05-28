import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
const p = new PrismaClient();
const t = await p.tour.findUnique({ where:{slug:'indospace-bommasandra'}, include:{scenes:{orderBy:{orderIndex:'asc'}}} });
console.log('idx  title                  WxH            ratio  MB');
for (const s of t.scenes) {
  try {
    const r = await fetch(s.imageUrl);
    const buf = Buffer.from(await r.arrayBuffer());
    const m = await sharp(buf).metadata();
    const ratio = (m.width/m.height).toFixed(2);
    const flag = m.width > 8192 ? ' <-- >8192 wide' : (Math.abs(m.width/m.height-2)>0.05?' <-- not 2:1':'');
    console.log(String(s.orderIndex).padStart(3), s.title.padEnd(22), `${m.width}x${m.height}`.padEnd(14), ratio, (buf.length/1048576).toFixed(1).padStart(5), flag);
  } catch(e){ console.log(String(s.orderIndex).padStart(3), s.title, 'ERR', e.message); }
}
await p.$disconnect();
