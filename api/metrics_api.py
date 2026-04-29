"""Metrics API - IMPROVEMENT 5 (Part 2: API Endpoint)

Simple HTTP API for metrics access from analytics dashboards.

Endpoints:
    GET /metrics          - Get all metrics
    GET /metrics/summary  - Get metric summaries
    GET /metrics/history  - Get recent metric history
    GET /health           - Health check

Usage:
    from api.metrics_api import create_metrics_server
    
    server = create_metrics_server(port=9090)
    server.start()
"""

import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, Dict, Any
from dataclasses import asdict

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from orchestration.metrics import get_metrics_collector, MetricsCollector
from orchestration.run_sessions import get_session_manager
from orchestration.scheduler import get_scheduler


class MetricsAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for metrics API."""
    
    # Reference to metrics collector (set by server)
    metrics: Optional[MetricsCollector] = None
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        pass
    
    def _send_json(self, data: Any, status: int = 200):
        """Send JSON response."""
        body = json.dumps(data, indent=2, default=str).encode('utf-8')
        
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)
    
    def _send_error(self, message: str, status: int = 400):
        """Send error response."""
        self._send_json({'error': message}, status)
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')
        query = parse_qs(parsed.query)
        
        handlers = {
            '/metrics': self._handle_metrics,
            '/metrics/summary': self._handle_summary,
            '/metrics/history': self._handle_history,
            '/health': self._handle_health,
            '/status': self._handle_status,
            '/runs': self._handle_runs,
        }
        
        handler = handlers.get(path)
        if handler:
            try:
                handler(query)
            except Exception as e:
                self._send_error(str(e), 500)
        else:
            self._send_error('Not found', 404)
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def _handle_metrics(self, query: Dict):
        """GET /metrics - Get all metrics."""
        if not self.metrics:
            self._send_error('Metrics not initialized', 500)
            return
        
        data = self.metrics.get_all_metrics()
        self._send_json(data)
    
    def _handle_summary(self, query: Dict):
        """GET /metrics/summary - Get metric summaries."""
        if not self.metrics:
            self._send_error('Metrics not initialized', 500)
            return
        
        summaries = self.metrics.get_summary()
        data = [asdict(s) for s in summaries]
        self._send_json({'summaries': data})
    
    def _handle_history(self, query: Dict):
        """GET /metrics/history - Get recent history."""
        if not self.metrics:
            self._send_error('Metrics not initialized', 500)
            return
        
        limit = int(query.get('limit', ['100'])[0])
        history = self.metrics.get_recent_history(limit)
        self._send_json({'history': history, 'count': len(history)})
    
    def _handle_health(self, query: Dict):
        """GET /health - Health check."""
        self._send_json({
            'status': 'healthy',
            'service': 'mission-control-metrics'
        })
    
    def _handle_status(self, query: Dict):
        """GET /status - System status."""
        scheduler = get_scheduler()
        session_mgr = get_session_manager()
        
        data = {
            'scheduler': scheduler.get_status(),
            'current_run': None,
            'metrics_enabled': self.metrics is not None
        }
        
        if session_mgr.current_run:
            data['current_run'] = session_mgr.current_run.get_summary()
        
        self._send_json(data)
    
    def _handle_runs(self, query: Dict):
        """GET /runs - List recent runs."""
        session_mgr = get_session_manager()
        limit = int(query.get('limit', ['20'])[0])
        
        runs = session_mgr.list_runs(limit)
        self._send_json({'runs': runs, 'count': len(runs)})


class MetricsServer:
    """HTTP server for metrics API."""
    
    def __init__(self, host: str = '0.0.0.0', port: int = 9090):
        self.host = host
        self.port = port
        self.server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
    
    def start(self, blocking: bool = False):
        """Start the metrics server.
        
        Args:
            blocking: If True, run in current thread
        """
        # Set metrics collector on handler
        MetricsAPIHandler.metrics = get_metrics_collector()
        
        self.server = HTTPServer((self.host, self.port), MetricsAPIHandler)
        self._running = True
        
        print(f"Metrics API server started at http://{self.host}:{self.port}")
        
        if blocking:
            self._serve()
        else:
            self._thread = threading.Thread(
                target=self._serve,
                name="MetricsAPIServer",
                daemon=True
            )
            self._thread.start()
    
    def _serve(self):
        """Serve requests until stopped."""
        while self._running:
            self.server.handle_request()
    
    def stop(self):
        """Stop the server."""
        self._running = False
        if self.server:
            self.server.shutdown()
        print("Metrics API server stopped")
    
    def get_url(self) -> str:
        """Get server URL."""
        return f"http://{self.host}:{self.port}"


def create_metrics_server(host: str = '0.0.0.0', port: int = 9090) -> MetricsServer:
    """Create a metrics server instance."""
    return MetricsServer(host, port)


if __name__ == '__main__':
    # Run standalone metrics server
    import argparse
    
    parser = argparse.ArgumentParser(description='Mission Control Metrics API')
    parser.add_argument('--host', default='0.0.0.0', help='Bind host')
    parser.add_argument('--port', type=int, default=9090, help='Bind port')
    args = parser.parse_args()
    
    server = create_metrics_server(args.host, args.port)
    try:
        server.start(blocking=True)
    except KeyboardInterrupt:
        server.stop()
