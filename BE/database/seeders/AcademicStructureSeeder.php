<?php

namespace Database\Seeders;

use App\Models\Program;
use App\Models\ProgramCurriculum;
use App\Models\Subject;
use Illuminate\Database\Seeder;

/**
 * Programs (IT, BSEd Math, BSEd Social Studies), subjects, curriculum,
 * class programme linkage, teacher–subject assignments, and demo timetables.
 *
 * Subject names are inspired by typical SHS ICT strands and BSEd prospectuses (e.g. DepEd ICT, BSEd Math).
 */
class AcademicStructureSeeder extends Seeder
{
    public function run(): void
    {
        $programs = [
            ['code' => 'it', 'name' => 'BSIT (Information Technology)', 'desc' => 'Four-year computing / ICT track (concepts from SHS ICT & programming strands).'],
            ['code' => 'ed_math', 'name' => 'Bachelor of Secondary Education (Mathematics)', 'desc' => 'Teacher-education program focused on mathematics pedagogy and content.'],
            ['code' => 'ed_social', 'name' => 'Bachelor of Secondary Education (Social Studies)', 'desc' => 'Teacher-education program for history, civics, geography, and related fields.'],
        ];
        foreach ($programs as $p) {
            Program::query()->firstOrCreate(
                ['code' => $p['code']],
                ['name' => $p['name'], 'duration_years' => 4, 'description' => $p['desc']]
            );
        }

        $progIt = Program::query()->where('code', 'it')->first();
        $progMath = Program::query()->where('code', 'ed_math')->first();
        $progSoc = Program::query()->where('code', 'ed_social')->first();

        foreach ([
            'IT-GEN-MATH' => 'General Mathematics',
            'IT-PROG1' => 'Programming Fundamentals',
            'IT-CSYS' => 'Computer Systems & Troubleshooting',
            'IT-COMM' => 'Oral Communication / English (BSIT)',
            'IT-PE1' => 'Physical Education & Health',
            'IT-STAT' => 'Statistics and Probability',
            'IT-WEB' => 'Web Technologies (HTML, CSS, JavaScript)',
            'IT-DB' => 'Database Systems',
            'IT-NET' => 'Networking Essentials',
            'IT-OOP' => 'Object-Oriented Programming',
            'IT-SE' => 'Software Engineering',
            'IT-SEC' => 'Cybersecurity Basics',
            'IT-CAP' => 'Capstone Project',
            'IT-MOB' => 'Mobile Application Development',
            'EDM-ALG' => 'College Algebra',
            'EDM-CALC-PREP' => 'Mathematics in the Modern World',
            'EDM-TP' => 'The Teaching Profession',
            'EDM-COMM' => 'Oral Communication / English (EDUC-MATH)',
            'EDM-MR' => 'Logic and Mathematical Reasoning',
            'EDM-TRIG' => 'Trigonometry',
            'EDM-STAT' => 'Elementary Statistics and Probability',
            'EDM-LA' => 'Linear Algebra',
            'EDM-CALC1' => 'Calculus I with Analytic Geometry',
            'EDM-EDTEC' => 'Technology for Teaching and Learning',
            'EDM-CALC2' => 'Calculus II',
            'EDM-ASSESS' => 'Assessment of Student Learning',
            'EDS-WH' => 'World History',
            'EDS-PH' => 'Readings in Philippine History',
            'EDS-SOC' => 'Introduction to Sociology',
            'EDS-ECO' => 'Basic Economics',
            'EDS-POL' => 'Political Science & Governance',
            'EDS-GEO' => 'Geography, Society, and Culture',
            'EDS-RESEARCH' => 'Research in Social Studies',
            'EDS-TP' => 'The Teaching Profession (EDUC-SOCIAL STUDIES)',
            'EDS-EDTEC' => 'Technology for Teaching and Learning (EDUC-SOCIAL STUDIES)',
            'EDS-COMM' => 'Oral Communication / English (EDUC-SOCIAL STUDIES)',
            'EDS-CURR' => 'The Teacher and the School Curriculum',
            'EDM-PRAC' => 'Practice Teaching / Field Study',
            'EDS-CAP' => 'Social Studies Practicum & Immersion',
        ] as $code => $name) {
            Subject::query()->updateOrCreate(['code' => $code], ['name' => $name]);
        }

        $sid = fn (string $code) => Subject::query()->where('code', $code)->value('id');

        $attachCurriculum = function (int $programId, int $year, array $codes) {
            foreach ($codes as $order => $code) {
                $subId = Subject::query()->where('code', $code)->value('id');
                if (! $subId) {
                    continue;
                }
                ProgramCurriculum::query()->updateOrCreate(
                    ['program_id' => $programId, 'year_level' => $year, 'subject_id' => $subId],
                    ['sort_order' => $order]
                );
            }
        };

        if ($progIt) {
            ProgramCurriculum::query()->where('program_id', $progIt->id)->delete();
            $attachCurriculum($progIt->id, 1, ['IT-GEN-MATH', 'IT-PROG1', 'IT-CSYS', 'IT-COMM', 'IT-PE1']);
            $attachCurriculum($progIt->id, 2, ['IT-STAT', 'IT-WEB', 'IT-DB', 'IT-NET', 'IT-COMM']);
            $attachCurriculum($progIt->id, 3, ['IT-OOP', 'IT-SE', 'IT-SEC', 'IT-WEB', 'IT-DB']);
            $attachCurriculum($progIt->id, 4, ['IT-CAP', 'IT-MOB', 'IT-OOP', 'IT-SE', 'IT-SEC']);
        }
        if ($progMath) {
            ProgramCurriculum::query()->where('program_id', $progMath->id)->delete();
            $attachCurriculum($progMath->id, 1, ['EDM-ALG', 'EDM-CALC-PREP', 'EDM-TP', 'EDM-MR', 'EDM-COMM']);
            $attachCurriculum($progMath->id, 2, ['EDM-TRIG', 'EDM-STAT', 'EDM-LA', 'EDM-CALC1', 'EDM-EDTEC']);
            $attachCurriculum($progMath->id, 3, ['EDM-CALC2', 'EDM-STAT', 'EDM-LA', 'EDM-ASSESS', 'EDM-ALG']);
            $attachCurriculum($progMath->id, 4, ['EDM-CALC2', 'EDM-ASSESS', 'EDM-EDTEC', 'EDM-PRAC', 'EDM-MR']);
        }
        if ($progSoc) {
            ProgramCurriculum::query()->where('program_id', $progSoc->id)->delete();
            $attachCurriculum($progSoc->id, 1, ['EDS-WH', 'EDS-PH', 'EDS-SOC', 'EDS-TP', 'EDS-COMM']);
            $attachCurriculum($progSoc->id, 2, ['EDS-ECO', 'EDS-POL', 'EDS-GEO', 'EDS-WH', 'EDS-EDTEC']);
            $attachCurriculum($progSoc->id, 3, ['EDS-RESEARCH', 'EDS-CURR', 'EDS-PH', 'EDS-SOC', 'EDS-POL']);
            $attachCurriculum($progSoc->id, 4, ['EDS-RESEARCH', 'EDS-CURR', 'EDS-GEO', 'EDS-ECO', 'EDS-CAP']);
        }
    }
}
