// Count Mon–Fri days in a month
const getWorkingDays = (month, year) => {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

const calculatePayroll = (employee, attendance, leaves, month, year) => {
  const workingDays  = getWorkingDays(month, year);

  // Guard: avoid divide-by-zero on months with no working days
  if (workingDays === 0) {
    return {
      baseSalary: employee.baseSalary, perDaySalary: 0, workingDays: 0,
      daysPresent: 0, halfDays: 0, lopDays: 0,
      grossSalary: 0, pfDeduction: 0, taxDeduction: 0,
      lopDeduction: 0, bonuses: 0, netSalary: 0,
    };
  }

  const perDaySalary = employee.baseSalary / workingDays;

  let daysPresent = 0, halfDays = 0, lopDays = 0;

  attendance.forEach((rec) => {
    if (rec.status === 'Present' || rec.status === 'Late') daysPresent++;
    if (rec.status === 'Half-Day') halfDays++;
  });

  leaves.forEach((leave) => {
    if (leave.leaveType === 'LOP' && leave.status === 'Approved') {
      lopDays += leave.numberOfDays;
    }
  });

  const effectiveDays = daysPresent + halfDays * 0.5;
  const grossSalary   = Math.round(perDaySalary * effectiveDays);
  const pfDeduction   = Math.round(grossSalary * 0.12);
  const lopDeduction  = Math.round(lopDays * perDaySalary);
  const netSalary     = Math.max(0, grossSalary - pfDeduction - lopDeduction);

  return {
    baseSalary: employee.baseSalary,
    perDaySalary: Math.round(perDaySalary),
    workingDays, daysPresent, halfDays, lopDays,
    grossSalary, pfDeduction, taxDeduction: 0,
    lopDeduction, bonuses: 0, netSalary,
  };
};

module.exports = { calculatePayroll, getWorkingDays };
