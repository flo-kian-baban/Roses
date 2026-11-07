// The rule for setting an admin PIN (Kian, 2026-11-06, replacing the 6 to 12 digits of the pre-go-live fix batch A1): 4 to 6 digits, like
// staff PINs, and no obvious pattern: not one digit repeated (1111) and not a straight run up or down (1234, 4321), 0 also counting after 9,
// as on a keyboard's top row (7890, 0987). Applied wherever an admin PIN is set: scripts/admin-create.mjs, with or without --reset (no admin
// screen sets an admin PIN; Team issues generated staff and owner PINs). A PIN set before is not checked again: the sign-in accepts every
// PIN it accepted before (4 to 12 digits, src/pages/api/admin/login.ts), so no admin PIN in use stops working.
const UP = '01234567890', DOWN = [...UP].reverse().join('');

// null when the PIN may be set, else the reason in one line
export function adminPinProblem(pin) {
  if (!/^\d{4,6}$/.test(pin)) return 'an admin PIN is 4 to 6 digits';
  if (/^(\d)\1+$/.test(pin)) return 'an admin PIN cannot be one digit repeated (like 1111)';
  if (UP.includes(pin) || DOWN.includes(pin)) return 'an admin PIN cannot be a straight run up or down (like 1234 or 4321)';
  return null;
}
