<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassAnnouncement;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $query = ClassAnnouncement::query()
            ->with(['schoolClass', 'creator'])
            ->orderByDesc('id');

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }

        if ($request->filled('created_by')) {
            $query->where('created_by', $request->integer('created_by'));
        }

        if ($request->filled('published')) {
            $published = filter_var($request->string('published')->toString(), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($published === true) {
                $query->whereNotNull('published_at');
            } elseif ($published === false) {
                $query->whereNull('published_at');
            }
        }

        return response()->json([
            'data' => $query->paginate(30),
        ]);
    }

    public function destroy(Request $request, ClassAnnouncement $announcement)
    {
        $id = $announcement->id;
        $announcement->delete();

        AuditLogger::log($request->user(), 'announcement.delete', null, "Deleted announcement {$id} (admin)");

        return response()->json(['ok' => true]);
    }
}

