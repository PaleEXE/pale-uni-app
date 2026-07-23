import sys
with open('src/app/graph/graph.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Page layout & sidebar start
start_str = """<div class="flex flex-col justify-center items-center h-full">
  <!-- Header -->
  <div class="flex justify-center items-center h-6 mb-8 mt-6">
    <h1 class="text-3xl font-bold text-primary-700">Graph Builder</h1>
  </div>

  <!-- Hidden File Input -->
  <input
    #fileInput
    type="file"
    accept="image/*"
    class="hidden"
    (change)="onFileSelected($event)"
  />

  <div class="flex flex-col">
    <div class="flex">
      <!-- ================= SIDEBAR ================= -->
      <div
        class="flex flex-col gap-6 m-6 w-64 p-6 bg-primary-100 border border-primary-300 rounded-lg shadow h-fit overflow-y-auto"
      >"""
start_rep = """<app-page-layout title="Graph Builder">
  <!-- Hidden File Input -->
  <input
    #fileInput
    type="file"
    accept="image/*"
    class="hidden"
    (change)="onFileSelected($event)"
  />

  <!-- ================= SIDEBAR ================= -->
  <app-sidebar-panel>"""
content = content.replace(start_str, start_rep)

# 2. Sidebar end
mid_str = """      </div>

      <!-- ================= MAIN VIEW ================= -->
      <div class="flex flex-col gap-6 mt-6 mr-6">"""
mid_rep = """  </app-sidebar-panel>

  <!-- ================= MAIN VIEW ================= -->
  <div class="flex flex-col gap-6 mt-6 mr-6">"""
content = content.replace(mid_str, mid_rep)

# 3. Page layout end
end_str = """    </div>
  </div>
</div>"""
end_rep = """  </div>
</app-page-layout>"""
content = content.replace(end_str, end_rep)

# 4. Label Edit Modal
label_modal_str = """                <!-- Label Edit Modal -->
                @if (editingNodeId() !== null) {
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/50 z-50"
                  (click)="cancelEditingLabel()"
                >
                  <div
                    class="bg-white p-6 rounded-lg shadow-lg border-2 border-primary-500"
                    (click)="$event.stopPropagation()"
                  >"""
label_modal_rep = """                <!-- Label Edit Modal -->
                <app-modal-overlay [opened]="editingNodeId() !== null" (closed)="cancelEditingLabel()">
                  <div
                    class="bg-white p-6 rounded-lg shadow-lg border-2 border-primary-500"
                    (click)="$event.stopPropagation()"
                  >"""
content = content.replace(label_modal_str, label_modal_rep)

label_modal_end_str = """                      </button>
                    </div>
                  </div>
                </div>
                }"""
label_modal_end_rep = """                      </button>
                    </div>
                  </div>
                </app-modal-overlay>"""
content = content.replace(label_modal_end_str, label_modal_end_rep)

# 5. Saved Graphs Modal
saved_modal_str = """                <!-- Saved Graphs Modal -->
                @if (showSavedVisuals()) {
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/50 z-50"
                  (click)="showSavedVisuals.set(false)"
                >
                  <div
                    class="bg-white p-6 rounded-lg shadow-lg border-2 border-primary-500 w-96 max-h-96 overflow-y-auto"
                    (click)="$event.stopPropagation()"
                  >"""
saved_modal_rep = """                <!-- Saved Graphs Modal -->
                <app-modal-overlay [opened]="showSavedVisuals()" (closed)="showSavedVisuals.set(false)">
                  <div
                    class="bg-white p-6 rounded-lg shadow-lg border-2 border-primary-500 w-96 max-h-96 overflow-y-auto"
                    (click)="$event.stopPropagation()"
                  >"""
content = content.replace(saved_modal_str, saved_modal_rep)

saved_modal_end_str = """                    <button
                      class="w-full mt-4 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                      (click)="showSavedVisuals.set(false)"
                    >
                      Close
                    </button>
                  </div>
                </div>
                }"""
saved_modal_end_rep = """                    <button
                      class="w-full mt-4 px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                      (click)="showSavedVisuals.set(false)"
                    >
                      Close
                    </button>
                  </div>
                </app-modal-overlay>"""
content = content.replace(saved_modal_end_str, saved_modal_end_rep)

# 6. Upload Alerts
upload_alert_str = """          @if (uploadSuccess()) {
          <div
            class="p-2 bg-green-100 border border-green-400 rounded text-xs text-green-800"
          >
            {{ uploadSuccess() }}
          </div>
          } @if (uploadError()) {
          <div
            class="p-2 bg-red-100 border border-red-400 rounded text-xs text-red-800"
          >
            {{ uploadError() }}
          </div>
          }"""
upload_alert_rep = """          @if (uploadSuccess()) {
            <app-alert-message type="success" [message]="uploadSuccess()!"></app-alert-message>
          } @if (uploadError()) {
            <app-alert-message type="error" [message]="uploadError()!"></app-alert-message>
          }"""
content = content.replace(upload_alert_str, upload_alert_rep)

# 7. Save Alerts
save_alert_str = """            @if (saveSuccess()) {
            <div
              class="mt-2 p-2 bg-green-100 border border-green-400 rounded text-xs text-green-800"
            >
              {{ saveSuccess() }}
            </div>
            } @if (saveError()) {
            <div
              class="mt-2 p-2 bg-red-100 border border-red-400 rounded text-xs text-red-800"
            >
              {{ saveError() }}
            </div>
            }"""
save_alert_rep = """            @if (saveSuccess()) {
              <app-alert-message type="success" [message]="saveSuccess()!"></app-alert-message>
            } @if (saveError()) {
              <app-alert-message type="error" [message]="saveError()!"></app-alert-message>
            }"""
content = content.replace(save_alert_str, save_alert_rep)

with open('src/app/graph/graph.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
