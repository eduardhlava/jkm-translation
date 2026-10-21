# Obsah dokumentu v editoru

- Pouze u otevřeného dokumentu přidat svislé ouško „Obsah“ a zavíratelný seznam nadpisů H1–H3.
- Na šířkách od 1024 px panel zabere přibližně 280 px a odsune editor; na užších šířkách se otevře přes editor.
- Živě zobrazovat názvy, společné číslování, odsazení úrovní a šedé nadpisy vyřazené z PDF; dlouhé názvy omezit na dva řádky s úplným názvem v tooltipu.
- Kliknutí plynule přesune editor na blok a krátce jej zvýrazní, bez rozbalení. Aktuální kapitola se označí při rolování a zůstane viditelná v obsahu.
- Zapamatovat otevření lokálně, výchozí stav zavřený. PDF, stránkování, Notion a uložená data dokumentu beze změny.

## Technické provedení a ověření
- Samostatná UI komponenta kolem BlockEditoru, čistá funkce pro položky obsahu se stávajícím headingNumbers.ts a stabilní značky na blocích.
- Vlastní scroll panelu i editoru pod současnou lištou; respektování omezení animací.
- Testy úrovní, pořadí, čísel, unlisted a prázdných názvů; ověření otevření, posunu, navigace, scroll-spy a sbalených bloků v přihlášeném náhledu.
- Verze 1.15.0 a požadovaná česká odrážka logu změn.