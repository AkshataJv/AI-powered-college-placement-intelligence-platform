import { randomUUID } from 'node:crypto'
import { db } from '../db.js'

export function seedHistoricalPlacementsIfEmpty() {
  const existingCount = db.prepare('SELECT COUNT(*) AS count FROM historical_placements').get()
  if (existingCount && existingCount.count > 0) {
    return
  }

  console.log('[Analytics Seed] Seeding historical college placement records...')

  const academicYears = [
    { year: '2022-23', batch: 2023, baseGrowth: 1.0 },
    { year: '2023-24', batch: 2024, baseGrowth: 1.15 },
    { year: '2024-25', batch: 2025, baseGrowth: 1.35 },
    { year: '2025-26', batch: 2026, baseGrowth: 1.48 },
  ]

  const branchDist = [
    { branch: 'CSE', eligibleBase: 70, weight: 0.32, avgSal: 11.5, maxSal: 44.0, skills: ['Python', 'Data Structures', 'Algorithms', 'Java', 'SQL', 'AWS', 'Docker'] },
    { branch: 'IT', eligibleBase: 50, weight: 0.24, avgSal: 10.2, maxSal: 38.0, skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'Cloud Computing'] },
    { branch: 'AIDS', eligibleBase: 45, weight: 0.20, avgSal: 12.0, maxSal: 42.0, skills: ['Python', 'Machine Learning', 'Deep Learning', 'PyTorch', 'Data Science', 'SQL'] },
    { branch: 'AIML', eligibleBase: 35, weight: 0.12, avgSal: 11.0, maxSal: 36.0, skills: ['Python', 'Artificial Intelligence', 'TensorFlow', 'NLP', 'Computer Vision'] },
    { branch: 'ENTC', eligibleBase: 40, weight: 0.10, avgSal: 7.5, maxSal: 22.0, skills: ['Embedded C', 'IoT', 'MATLAB', 'Python', 'VLSI', 'Verilog'] },
    { branch: 'MECH', eligibleBase: 45, weight: 0.08, avgSal: 6.8, maxSal: 15.0, skills: ['AutoCAD', 'SolidWorks', 'ANSYS', 'Robotics', 'Python', 'Manufacturing'] },
    { branch: 'CIVIL', eligibleBase: 30, weight: 0.05, avgSal: 6.2, maxSal: 12.5, skills: ['AutoCAD', 'Revit', 'Structural Analysis', 'Project Management', 'GIS'] },
  ]

  const companiesList = [
    { company: 'Google', role: 'Software Engineer', salaryRange: [32, 44], branches: ['CSE', 'IT', 'AIDS', 'AIML'] },
    { company: 'Microsoft', role: 'Software Development Engineer', salaryRange: [28, 42], branches: ['CSE', 'IT', 'AIDS', 'AIML'] },
    { company: 'Amazon', role: 'SDE-1', salaryRange: [26, 36], branches: ['CSE', 'IT', 'AIDS'] },
    { company: 'NVIDIA', role: 'AI Platform Engineer', salaryRange: [24, 38], branches: ['AIDS', 'AIML', 'CSE'] },
    { company: 'Persistent Systems', role: 'Associate Software Engineer', salaryRange: [9, 14], branches: ['CSE', 'IT', 'AIDS', 'AIML', 'ENTC'] },
    { company: 'Veritas', role: 'Software Engineer', salaryRange: [12, 17], branches: ['CSE', 'IT', 'AIDS'] },
    { company: 'Bajaj Finserv', role: 'Data Analyst & ML Associate', salaryRange: [9.5, 13.5], branches: ['AIDS', 'AIML', 'CSE', 'IT'] },
    { company: 'ESDS Software', role: 'Cloud Engineer', salaryRange: [7.5, 11], branches: ['CSE', 'IT', 'ENTC'] },
    { company: 'Amdocs', role: 'Software Engineering Associate', salaryRange: [8, 11.5], branches: ['CSE', 'IT', 'ENTC'] },
    { company: 'TCS Digital', role: 'System Engineer', salaryRange: [7, 8.5], branches: ['CSE', 'IT', 'AIDS', 'AIML', 'ENTC', 'MECH', 'CIVIL'] },
    { company: 'TCS Ninja', role: 'Assistant System Engineer', salaryRange: [3.8, 4.5], branches: ['CSE', 'IT', 'AIDS', 'AIML', 'ENTC', 'MECH', 'CIVIL'] },
    { company: 'Infosys', role: 'Specialist Programmer', salaryRange: [6.5, 9.5], branches: ['CSE', 'IT', 'AIDS', 'AIML'] },
    { company: 'LTI Mindtree', role: 'Graduate Trainee', salaryRange: [5, 7.5], branches: ['CSE', 'IT', 'ENTC', 'MECH'] },
    { company: 'Siemens', role: 'Graduate Engineer Trainee', salaryRange: [6.5, 10.5], branches: ['ENTC', 'MECH', 'CSE'] },
    { company: 'Tata Motors', role: 'Design & Automation Engineer', salaryRange: [6, 9], branches: ['MECH', 'ENTC'] },
    { company: 'Larsen & Toubro', role: 'Graduate Trainee Engineer', salaryRange: [5.5, 8.5], branches: ['CIVIL', 'MECH', 'ENTC'] },
  ]

  const firstNames = ['Aarav', 'Ananya', 'Rohan', 'Isha', 'Vikram', 'Pooja', 'Aditya', 'Sneha', 'Kunal', 'Riya', 'Sameer', 'Priyanka', 'Dev', 'Tanvi', 'Abhishek', 'Kavya', 'Gaurav', 'Neha', 'Rahul', 'Divya', 'Siddharth', 'Meera', 'Varun', 'Shreya', 'Amit', 'Swati', 'Harsh', 'Radhika', 'Nikhil', 'Simran']
  const lastNames = ['Sharma', 'Patil', 'Kulkarni', 'Deshmukh', 'Joshi', 'Verma', 'Pawar', 'Mehta', 'Gupta', 'Shinde', 'Iyer', 'Nair', 'Bose', 'Chavan', 'Wagh', 'Hudekar', 'Jadhav', 'More', 'Chopra', 'Malhotra', 'Bhat', 'Rao', 'Gaikwad', 'Tambe', 'Sane']

  const insertPlacement = db.prepare(`
    INSERT INTO historical_placements (
      id, student_name, student_identifier, branch, company, role, salary, academic_year, batch_year, skills_json, placed_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertEligible = db.prepare(`
    INSERT OR REPLACE INTO historical_eligible_counts (
      id, academic_year, branch, eligible_count, total_students
    ) VALUES (?, ?, ?, ?, ?)
  `)

  let studentSeq = 1000

  const seedTx = db.transaction(() => {
    for (const ay of academicYears) {
      for (const b of branchDist) {
        // Calculate eligible count for this branch and academic year
        const eligibleCount = Math.round(b.eligibleBase * ay.baseGrowth)
        const totalCount = Math.round(eligibleCount * 1.12)
        insertEligible.run(randomUUID(), ay.year, b.branch, eligibleCount, totalCount)

        // Target placement percentage grows realistically across years
        // 2022-23: ~75-82%, 2023-24: ~80-87%, 2024-25: ~85-93%, 2025-26: ~78-85% (ongoing)
        let targetPlacementPct = 0.78
        if (ay.year === '2023-24') targetPlacementPct = 0.84
        else if (ay.year === '2024-25') targetPlacementPct = 0.90
        else if (ay.year === '2025-26') targetPlacementPct = 0.81

        if (b.branch === 'CSE' || b.branch === 'AIDS') targetPlacementPct += 0.05
        if (b.branch === 'MECH' || b.branch === 'CIVIL') targetPlacementPct -= 0.12

        const placedStudentCount = Math.max(5, Math.min(eligibleCount, Math.round(eligibleCount * targetPlacementPct)))

        // For each placed student:
        for (let i = 0; i < placedStudentCount; i++) {
          studentSeq++
          const studentId = `HIST-${ay.batch}-${b.branch}-${studentSeq}`
          const name = `${firstNames[studentSeq % firstNames.length]} ${lastNames[(studentSeq * 7) % lastNames.length]}`

          // Pick matching company
          const validCompanies = companiesList.filter((c) => c.branches.includes(b.branch))
          const companyObj = validCompanies[i % validCompanies.length]

          const minSal = companyObj.salaryRange[0]
          const maxSal = companyObj.salaryRange[1]
          const salary = Math.round((minSal + ((studentSeq * 17) % 100) / 100 * (maxSal - minSal)) * 10) / 10

          // Skills sample
          const skillsSample = b.skills.slice(0, 3 + (i % 3))

          const placedMonth = 8 + (i % 8) // Sep to April
          const monthStr = placedMonth > 12 ? String(placedMonth - 12).padStart(2, '0') : String(placedMonth).padStart(2, '0')
          const placedYearNum = placedMonth > 12 ? ay.batch : ay.batch - 1
          const placedDate = `${placedYearNum}-${monthStr}-15`

          insertPlacement.run(
            randomUUID(),
            name,
            studentId,
            b.branch,
            companyObj.company,
            companyObj.role,
            salary,
            ay.year,
            ay.batch,
            JSON.stringify(skillsSample),
            placedDate
          )

          // 20% of students receive multiple offers (e.g. earlier offer from mass recruiter + dream offer)
          if (i % 5 === 0 && validCompanies.length > 1) {
            const secondCompany = validCompanies[(i + 1) % validCompanies.length]
            const secondSalary = Math.round((secondCompany.salaryRange[0] + 0.5) * 10) / 10
            insertPlacement.run(
              randomUUID(),
              name,
              studentId, // SAME student_identifier so unique students != total offers
              b.branch,
              secondCompany.company,
              secondCompany.role,
              secondSalary,
              ay.year,
              ay.batch,
              JSON.stringify(skillsSample),
              placedDate
            )
          }
        }
      }
    }
  })

  seedTx()
  console.log('[Analytics Seed] Historical college placement data seeded successfully.')
}
