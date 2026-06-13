<?php

use App\Http\Controllers\Api\Admin\AbsenceReportController;
use App\Http\Controllers\Api\Admin\AbsenceReportExportController;
use App\Http\Controllers\Api\Admin\AnnouncementCommentController;
use App\Http\Controllers\Api\Admin\AnnouncementController;
use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\ClassSubjectTeacherController;
use App\Http\Controllers\Api\Admin\ProgramController;
use App\Http\Controllers\Api\Admin\SchoolClassController;
use App\Http\Controllers\Api\Admin\SchoolYearController;
use App\Http\Controllers\Api\Admin\StudentInviteController;
use App\Http\Controllers\Api\Admin\SubjectController;
use App\Http\Controllers\Api\Admin\TimetableSlotController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\UserImportExportController;
use App\Http\Controllers\Api\Auth\StudentInviteAuthController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\Student\AbsenceAttachmentController;
use App\Http\Controllers\Api\Student\AttendanceSessionCheckInController;
use App\Http\Controllers\Api\Student\MyAbsenceReportsController;
use App\Http\Controllers\Api\Student\MyAttendanceController;
use App\Http\Controllers\Api\Student\StudentQrController;
use App\Http\Controllers\Api\Student\StudentScheduleController;
use App\Http\Controllers\Api\Student\StudentSubjectsController;
use App\Http\Controllers\Api\Teacher\AbsenceReportReviewController;
use App\Http\Controllers\Api\Teacher\AttendanceController;
use App\Http\Controllers\Api\Teacher\AttendanceExportController;
use App\Http\Controllers\Api\Teacher\AttendanceSessionController;
use App\Http\Controllers\Api\Teacher\ClassRosterController;
use App\Http\Controllers\Api\Teacher\DashboardStatsController;
use App\Http\Controllers\Api\Teacher\MyClassesController;
use App\Http\Controllers\Api\Teacher\TeacherQrController;
use App\Http\Controllers\Api\Teacher\TeacherTeachingController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::middleware('x-api-key')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('/student-invites/accept', [StudentInviteAuthController::class, 'accept'])->middleware('throttle:login');
        Route::middleware('auth:sanctum')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
            Route::patch('/profile', [AuthController::class, 'updateProfile']);
        });
    });

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::get('/roles', [RoleController::class, 'index'])->middleware('role:admin');

        Route::prefix('admin')->middleware('role:admin')->group(function () {
            Route::apiResource('users', UserController::class);
            Route::get('users-export', [UserImportExportController::class, 'export']);
            Route::post('users-import', [UserImportExportController::class, 'import']);
            Route::get('student-invites', [StudentInviteController::class, 'index']);
            Route::post('student-invites/bulk-create', [StudentInviteController::class, 'bulkCreate']);
            Route::post('student-invites/{invite}/resend', [StudentInviteController::class, 'resend']);
            Route::post('users/{user}/resend-password-setup', [StudentInviteController::class, 'resendForUser']);

            Route::apiResource('school-years', SchoolYearController::class);
            Route::post('school-years/{school_year}/set-active', [SchoolYearController::class, 'setActive']);
            Route::apiResource('classes', SchoolClassController::class);

            Route::get('audit-logs', [AuditLogController::class, 'index']);

            Route::get('absence-reports', [AbsenceReportController::class, 'index']);
            Route::get('absence-reports/{absence_report}', [AbsenceReportController::class, 'show']);
            Route::post('absence-reports/{absence_report}/approve', [AbsenceReportController::class, 'approve']);
            Route::post('absence-reports/{absence_report}/reject', [AbsenceReportController::class, 'reject']);
            Route::get('absence-reports-export', [AbsenceReportExportController::class, 'export']);

            Route::get('announcements', [AnnouncementController::class, 'index']);
            Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy']);

            Route::get('announcement-comments', [AnnouncementCommentController::class, 'index']);
            Route::delete('announcement-comments/{comment}', [AnnouncementCommentController::class, 'destroy']);

            Route::get('programs', [ProgramController::class, 'index']);
            Route::apiResource('subjects', SubjectController::class)->only(['index', 'store', 'update', 'destroy']);
            Route::get('class-subject-teachers', [ClassSubjectTeacherController::class, 'index']);
            Route::post('class-subject-teachers', [ClassSubjectTeacherController::class, 'store']);
            Route::delete('class-subject-teachers/{classSubjectTeacher}', [ClassSubjectTeacherController::class, 'destroy']);
            Route::get('timetable-slots', [TimetableSlotController::class, 'index']);
            Route::post('timetable-slots', [TimetableSlotController::class, 'store']);
            Route::patch('timetable-slots/{timetableSlot}', [TimetableSlotController::class, 'update']);
            Route::delete('timetable-slots/{timetableSlot}', [TimetableSlotController::class, 'destroy']);
        });

        Route::prefix('teacher')->middleware('role:teacher')->group(function () {
            Route::get('my-teaching', [TeacherTeachingController::class, 'index']);
            Route::get('classes', [MyClassesController::class, 'index']);
            Route::get('classes/{class}/roster', [ClassRosterController::class, 'index']);
            Route::post('attendance/mark', [AttendanceController::class, 'mark']);
            Route::get('attendance', [AttendanceController::class, 'index']);
            Route::get('attendance-export', [AttendanceExportController::class, 'export']);
            Route::get('dashboard-stats', [DashboardStatsController::class, 'index']);
            Route::get('qr-card', [TeacherQrController::class, 'show']);
            Route::get('qr-image', [TeacherQrController::class, 'qrImage']);

            Route::post('attendance-sessions', [AttendanceSessionController::class, 'store']);
            Route::post('attendance-sessions/{attendance_session}/close', [AttendanceSessionController::class, 'close']);
            Route::get('attendance-sessions/{attendance_session}/qr', [AttendanceSessionController::class, 'qr']);

            Route::get('absence-reports', [AbsenceReportReviewController::class, 'index']);
            Route::post('absence-reports/{absence_report}/approve', [AbsenceReportReviewController::class, 'approve']);
            Route::post('absence-reports/{absence_report}/reject', [AbsenceReportReviewController::class, 'reject']);

            Route::get('announcements', [App\Http\Controllers\Api\Teacher\AnnouncementController::class, 'index']);
            Route::post('announcements', [App\Http\Controllers\Api\Teacher\AnnouncementController::class, 'store']);
            Route::post('announcements/{announcement}/publish', [App\Http\Controllers\Api\Teacher\AnnouncementController::class, 'publish']);
            Route::delete('announcements/{announcement}', [App\Http\Controllers\Api\Teacher\AnnouncementController::class, 'destroy']);

            Route::get('announcement-comments', [App\Http\Controllers\Api\Teacher\AnnouncementCommentController::class, 'index']);
            Route::post('announcement-comments/{comment}/hide', [App\Http\Controllers\Api\Teacher\AnnouncementCommentController::class, 'hide']);
            Route::post('announcement-comments/{comment}/unhide', [App\Http\Controllers\Api\Teacher\AnnouncementCommentController::class, 'unhide']);
            Route::delete('announcement-comments/{comment}', [App\Http\Controllers\Api\Teacher\AnnouncementCommentController::class, 'destroy']);
        });

        Route::prefix('student')->middleware('role:student')->group(function () {
            Route::get('schedule', [StudentScheduleController::class, 'index']);
            Route::get('my-subjects', [StudentSubjectsController::class, 'index']);
            Route::get('qr-card', [StudentQrController::class, 'show']);
            Route::get('qr-image', [StudentQrController::class, 'qrImage']);
            Route::get('attendance', [MyAttendanceController::class, 'index']);
            Route::get('absence-reports', [MyAbsenceReportsController::class, 'index']);
            Route::post('absence-reports', [MyAbsenceReportsController::class, 'store']);
            Route::get('absence-attachments/{attachment}', [AbsenceAttachmentController::class, 'show']);

            Route::post('attendance-sessions/check-in', [AttendanceSessionCheckInController::class, 'store']);
            Route::get('dashboard-stats', [App\Http\Controllers\Api\Student\DashboardStatsController::class, 'index']);

            Route::get('announcements', [App\Http\Controllers\Api\Student\AnnouncementController::class, 'index']);
            Route::post('announcements/{announcement}/read', [App\Http\Controllers\Api\Student\AnnouncementController::class, 'markRead']);

            Route::get('announcements/{announcement}/comments', [App\Http\Controllers\Api\Student\AnnouncementCommentController::class, 'index']);
            Route::post('announcements/{announcement}/comments', [App\Http\Controllers\Api\Student\AnnouncementCommentController::class, 'store']);
            Route::put('announcement-comments/{comment}', [App\Http\Controllers\Api\Student\AnnouncementCommentController::class, 'update']);
            Route::delete('announcement-comments/{comment}', [App\Http\Controllers\Api\Student\AnnouncementCommentController::class, 'destroy']);
        });
    });
});
