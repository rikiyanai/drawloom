import SwiftUI
import UIKit

struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}

struct ContentView: View {
    @StateObject private var session = ARFaceSession()
    @State private var shareItem: ShareItem?

    var body: some View {
        ZStack {
            ARFaceView(session: session)
                .ignoresSafeArea()

            VStack {
                HStack {
                    statusBadge
                    Spacer()
                }
                .padding()
                Spacer()
                HStack {
                    Spacer()
                    Button(action: {
                        if let url = session.exportLatestPacket() {
                            shareItem = ShareItem(url: url)
                        }
                    }) {
                        Text("Export JSON")
                            .font(.system(.body, design: .monospaced))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(.white)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }
                }
                .padding()
            }
        }
        .sheet(item: $shareItem) { item in
            ActivityView(items: [item.url])
        }
    }

    private var statusBadge: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(session.status)
                .font(.system(.caption, design: .monospaced))
            Text("frames: \(session.frameCount)")
                .font(.system(.caption2, design: .monospaced))
            if !session.lastExport.isEmpty {
                Text(session.lastExport)
                    .font(.system(.caption2, design: .monospaced))
            }
        }
        .padding(8)
        .background(.black.opacity(0.55))
        .foregroundColor(.white)
        .cornerRadius(8)
    }
}

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
