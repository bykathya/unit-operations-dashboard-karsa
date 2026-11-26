// Menolkan sementara semua angka Bio studio yang dibaca buku besar circle (biaya rutin, THP, SHU) untuk unit uji,
// agar hitungan tes eksak. Kembalikan fungsi pemulih — WAJIB dipanggil di finally.
export async function nolkanBio(prisma, studioIds) {
  const [rutin, thp, shu] = await Promise.all([
    prisma.studioPengeluaranRutin.findMany({ where: { studioId: { in: studioIds } }, select: { id: true, jumlah: true } }),
    prisma.userRole.findMany({ where: { studioId: { in: studioIds }, takeHomePay: { not: null } }, select: { id: true, takeHomePay: true } }),
    prisma.studio.findMany({ where: { id: { in: studioIds } }, select: { id: true, statusShu: true, totalShu: true } }),
  ])
  await prisma.studioPengeluaranRutin.updateMany({ where: { id: { in: rutin.map(x => x.id) } }, data: { jumlah: 0 } })
  await prisma.userRole.updateMany({ where: { id: { in: thp.map(x => x.id) } }, data: { takeHomePay: 0 } })
  await prisma.studio.updateMany({ where: { id: { in: studioIds } }, data: { statusShu: false } })
  return async () => {
    for (const x of rutin) await prisma.studioPengeluaranRutin.update({ where: { id: x.id }, data: { jumlah: x.jumlah } })
    for (const x of thp) await prisma.userRole.update({ where: { id: x.id }, data: { takeHomePay: x.takeHomePay } })
    for (const x of shu) await prisma.studio.update({ where: { id: x.id }, data: { statusShu: x.statusShu, totalShu: x.totalShu } })
  }
}
