# Research: Sistema Mixto de Repartición (Granos + Saldo Monetario)

He analizado a fondo la lógica de `Contaduría` en `investors/page.tsx` y cómo el sistema actualmente calcula los totales por socios. Aquí te detallo el diagnóstico de por qué ocurre el problema y la solución arquitectónica precisa para el "Sistema Mixto".

## 1. El Problema Actual con el Switch de "Modo de Campaña"
Actualmente, el cálculo de asignación de granos se realiza mediante este bloque de código (línea 335 aprox.):
```typescript
if (!campaignInfo || campaignInfo.mode !== 'GRAIN') return;
```
Esto significa que si cambias la campaña de vuelta a "Saldo Monetario", el sistema instantáneamente deja de calcular la `Cosecha Asignada` (cae a `0 kg`), pero los movimientos de `OUT` (los retiros de los socios) siguen existiendo en la base de datos, por lo que la `Cosecha Retirada` muestra el valor real (ej. `122,223 kg`). Esto rompe la consistencia visual y matemática.

Además, actualmente la "Cosecha Asignada" toma en cuenta el **100% de lo cosechado**. Si decides vender una parte, el sistema asignaría el doble (reparte el dinero de la venta, y *además* sigue repartiendo el total de los granos físicos como si nunca se hubieran vendido).

## 2. La Solución Técnica: El Sistema Mixto Universal

Para implementar la visión que propones, la campaña no debería ser mutuamente excluyente entre "Grano" o "Dinero". Toda campaña debería manejar ambas columnas y auto-balancearse.
El sistema actual **ya hace el 50% del trabajo** de forma excelente: el dinero de ventas (`SALE`) ya se distribuye proporcionalmente y afecta el `Saldo Monetario`. 

La solución requiere 3 pasos precisos:

### A. Eliminar el filtro excluyente de Modalidad
Eliminar la condición que frena el cálculo si el modo no es `GRAIN`. Todas las campañas mostrarán las columnas de Inversión, Saldo Monetario, y Granos. Podemos deprecación el selector de modo en la UI de "Gestionar Campañas", ya que siempre será un sistema Mixto.

### B. Descuento de Granos Vendidos (El "Stock Neto a Repartir")
Actualmente solo rastreamos lo Cosechado (`HARVEST`). 
Debemos modificar el hook de generación de estadísticas financieras para rastrear la cantidad física en las ventas (`SALE`):
```typescript
salesByCampaignCrop[m.campaignId][crop] = (salesByCampaignCrop[m.campaignId][crop] || 0) + m.quantity;
```
Luego, al momento de asignar el cupo máximo por socio (`Cosecha Asignada`), la fórmula será:
`Grano Neto = (Total Cosechado) - (Total Vendido)`
Ese *Grano Neto* es el que se multiplicará por el porcentaje de participación del socio.

### C. Gestión Manual de Errores (Socio sobregirado)
Como mencionaste, si un socio retira su 100% de granos hoy, y mañana la administración decide vender granos de la campaña, el "Grano Neto" bajará, y el cupo del socio quedará en negativo (Cosecha Asignada < Cosecha Retirada).
Para manejar esto, ya que los administradores lo corregirán tocando números (ej. transfiriendo saldo monetario a favor del socio como si él hubiera vendido, o ajustando movimientos), la UI simplemente permitirá que el número de "Cosecha Asignada" se muestre de forma dinámica, resaltando en rojo si el socio "retiró más de lo que finalmente le correspondía tras la venta".

## ¿Deseas que proceda con este plan?
Es una refactorización hermosa y limpia en `investors/page.tsx` que no romperá datos pasados, sino que hará que calcen de forma orgánica. Solo removeré los selectos de modo de campaña y ajustaré los cálculos para habilitar la modalidad mixta universal.
