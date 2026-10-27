// Fixed lookup lists. Departments are NOT here any more: they live in the
// `departments` table and are read through /api/departments (see lib/useDepartments.js).

export const BED_LABELS = ['A', 'B', 'C', 'D']

export const PERSON_TYPES = [
  { id: 'patient', name: 'مريض' },
  { id: 'companion', name: 'مرافق' },
]

export const MEAL_TIMES = [
  { id: 'breakfast', name: 'فطور' },
  { id: 'lunch', name: 'غداء' },
  { id: 'dinner', name: 'عشاء' },
]
export const MEAL_TIME_BY_ID = Object.fromEntries(MEAL_TIMES.map((m) => [m.id, m]))

export const MAIN_MEALS = ['وجبة عادية', 'وجبة دايت', 'وجبة مرضى السكري', 'وجبة مرضى الضغط', 'وجبة سائلة', 'وجبة لينة']

export const OPTIONAL_ITEMS = ['عصير طازج', 'فاكهة', 'زبادي', 'حلى', 'شاي / قهوة', 'ماء', 'سلطة', 'شوربة']

export const WEEK_DAYS = [
  { id: 'sun', name: 'الأحد' },
  { id: 'mon', name: 'الإثنين' },
  { id: 'tue', name: 'الثلاثاء' },
  { id: 'wed', name: 'الأربعاء' },
  { id: 'thu', name: 'الخميس' },
  { id: 'fri', name: 'الجمعة' },
  { id: 'sat', name: 'السبت' },
]
export const DAY_BY_ID = Object.fromEntries(WEEK_DAYS.map((d) => [d.id, d]))

export const MEAL_TYPES = ['main', 'optional', 'custom']

export const personTypeName = (id) => PERSON_TYPES.find((p) => p.id === id)?.name || id
export const bedLabel = (bed) => BED_LABELS[Number(bed) - 1] || bed
