// Terminal functionality
document.addEventListener('DOMContentLoaded', function() {
    const terminalInput = document.getElementById('terminalInput');
    const terminalOutput = document.getElementById('terminalOutput');
    const sendBtn = document.getElementById('sendBtn');

    // Function to append output to terminal
    function appendOutput(text, type = 'default') {
        const p = document.createElement('p');
        p.className = `terminal-${type}`;
        p.textContent = text;
        terminalOutput.appendChild(p);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Function to execute SQL query
    async function executeSQL() {
        const sql = terminalInput.value.trim();
        
        if (!sql) {
            appendOutput('Error: Empty query', 'error');
            return;
        }

        // Display the query being executed
        appendOutput(`> ${sql}`, 'query');
        
        try {
            // Show loading state
            sendBtn.disabled = true;
            sendBtn.textContent = 'Executing...';

            // Use absolute path to avoid base href interference
            const apiUrl = window.location.origin + '/api/user/query';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql })
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                appendOutput(`Error: Server returned HTML instead of JSON`, 'error');
                appendOutput(`Status: ${response.status} ${response.statusText}`, 'error');
                appendOutput(`URL: ${response.url}`, 'error');
                appendOutput(`Check that your backend route '/query' exists and is working`, 'error');
                console.error('Response text:', text.substring(0, 200));
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                appendOutput(`Error: ${data.error || 'Query failed'}`, 'error');
            } else {
                // Format and display results
                if (Array.isArray(data) && data.length > 0) {
                    appendOutput(`Results: ${data.length} row(s)`, 'success');
                    appendOutput(JSON.stringify(data, null, 2), 'result');
                } else if (data.affectedRows !== undefined) {
                    appendOutput(`Success: ${data.affectedRows} row(s) affected`, 'success');
                } else {
                    appendOutput(JSON.stringify(data, null, 2), 'result');
                }
            }
        } catch (error) {
            appendOutput(`Error: ${error.message}`, 'error');
        } finally {
            // Reset button state
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
            
            // Clear input
            terminalInput.value = '';
        }
    }

    // Event listeners
    sendBtn.addEventListener('click', executeSQL);

    // Allow Ctrl+Enter to execute
    terminalInput.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            executeSQL();
        }
    });

    // Initial message
    appendOutput('Type your SQL query and press Send or Ctrl+Enter', 'info');
    appendOutput('Example: SELECT * FROM user LIMIT 10', 'info');
});