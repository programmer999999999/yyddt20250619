// Supabase configuration
const SUPABASE_URL = 'https://ulubhlqqclyfjbgeuswf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdWJobHFxY2x5ZmpiZ2V1c3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzMTk3MzAsImV4cCI6MjA2NTg5NTczMH0.S90YvP3DGAn-Y7-WOQ7RPIviXFRDtq_OPHWIZRbXLEU';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export the Supabase client
window.supabase = supabaseClient;

// Message handling
document.addEventListener('DOMContentLoaded', function() {
    const messageForm = document.getElementById('messageForm');
    const messagesList = document.getElementById('messagesList');
    const fileInput1 = document.getElementById('imageUpload1');
    const fileInput2 = document.getElementById('imageUpload2');
    const fileError1 = document.getElementById('fileError1');
    const fileError2 = document.getElementById('fileError2');
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    const BUCKET_NAME = 'message_images';

    // Function to validate file size
    function validateFileSize(fileInput, errorElement) {
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > MAX_FILE_SIZE) {
                if (errorElement) {
                    errorElement.textContent = '文件大小不能超过 2MB';
                }
                fileInput.value = ''; // Clear the file input
                return false;
            } else if (errorElement) {
                errorElement.textContent = '';
            }
        }
        return true;
    }


    if (messageForm) {
        // Handle file selection for first image
        if (fileInput1) {
            fileInput1.addEventListener('change', function(e) {
                validateFileSize(fileInput1, fileError1);
            });
        }

        // Handle file selection for second image
        if (fileInput2) {
            fileInput2.addEventListener('change', function(e) {
                validateFileSize(fileInput2, fileError2);
            });
        }

        // Handle form submission
        messageForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            
            if (!username) {
                alert('请输入游戏昵称');
                return;
            }

            // Check file sizes again in case client-side validation was bypassed
            if (fileInput1 && fileInput1.files.length > 0 && fileInput1.files[0].size > MAX_FILE_SIZE) {
                fileError1.textContent = '文件大小不能超过 1MB';
                return;
            }
            
            if (fileInput2 && fileInput2.files.length > 0 && fileInput2.files[0].size > MAX_FILE_SIZE) {
                fileError2.textContent = '文件大小不能超过 1MB';
                return;
            }
            
            // Show loading state
            const submitButton = messageForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = '提交中...';
            
            try {
                let imageUrl1 = null;
                let imageUrl2 = null;
                
                // Function to upload a single image
                async function uploadImage(fileInputId) {
                    const fileInput = document.getElementById(fileInputId);
                    if (!fileInput.files || fileInput.files.length === 0) return null;
                    
                    const file = fileInput.files[0];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                    const filePath = `${fileName}`;
                    
                    // Validate file size (1MB max)
                    if (file.size > 1 * 1024 * 1024) {
                        throw new Error(`图片 ${file.name} 大小不能超过1MB`);
                    }
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(filePath, file);
                    
                    if (uploadError) throw uploadError;
                    
                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(filePath);
                        
                    return publicUrl;
                }
                
                // Upload both images in parallel
                try {
                    [imageUrl1, imageUrl2] = await Promise.all([
                        uploadImage('imageUpload1'),
                        uploadImage('imageUpload2')
                    ]);
                } catch (error) {
                    alert(error.message);
                    return;
                }
                
                // Insert message to Supabase
                const newMessage = { 
                    username: username,
                    message: '', // Empty message since we removed the field
                    image_url: imageUrl1,
                    image_url2: imageUrl2,
                    created_at: new Date().toISOString(),
                    status: 0 // Default status is 0 (pending)
                };

                const { data, error } = await supabase
                    .from('messages')
                    .insert([newMessage])
                    .select()
                    .single();
                
                if (error) {
                    console.error('Error inserting message:', error);
                    throw error;
                }
                
                // Clear the form and error messages
                messageForm.reset();
                if (fileError1) fileError1.textContent = '';
                if (fileError2) fileError2.textContent = '';
                
                // If real-time subscription fails, manually add the message
                if (data && data[0]) {
                    displayMessage(data[0]);
                }
                
                // Refresh the page after a short delay to show the new message
                // setTimeout(() => {
                //     window.location.reload();
                // }, 100);
                
            } catch (error) {
                console.error('Error:', error);
                alert('提交失败，请重试: ' + error.message);
            } finally {
                // Reset button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }
    
    // Toggle message status (0 = red, 1 = green)
    async function toggleStatus(messageId, currentStatus) {
        // If status is already approved (1), do nothing
        if (currentStatus === 1) return;
        
        const password = prompt('请输入密码:');
        if (password === 'fuzhu666') {
            try {
                //console.log('Updating message ID:', messageId, 'to status 1');
                
                // First, verify the message exists and get current status
                const { data: existingMessage, error: fetchError } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('id', messageId)
                    .single();
                
                if (fetchError) throw new Error('无法获取消息: ' + fetchError.message);
                //console.log('Current message data:', existingMessage);
                
                // Update status in the database using rpc for better reliability
                const { data, error } = await supabase.rpc('update_message_status', {
                    p_message_id: messageId,
                    p_status: 1,
                    p_updated_at: new Date().toISOString()
                });
                
                if (error) {
                    console.error('RPC update error:', error);
                    throw error;
                }
                
                //console.log('RPC update response:', data);
                
                // Update the UI
                const statusElement = document.querySelector(`[data-message-id="${messageId}"] .status-indicator`);
                if (statusElement) {
                    statusElement.className = 'status-indicator status-approved';
                    statusElement.style.cursor = 'default';
                    statusElement.removeAttribute('onclick');
                    statusElement.title = '已审核';
                    //console.log('UI updated for message ID:', messageId);
                }
                
                // Verify the update with a small delay
                setTimeout(async () => {
                    const { data: verifyData, error: verifyError } = await supabase
                        .from('messages')
                        .select('status, updated_at')
                        .eq('id', messageId)
                        .single();
                    
                    if (verifyError) {
                        console.error('Verification error:', verifyError);
                    } else {
                        //console.log('Verified status in database:', verifyData);
                        if (verifyData.status !== 1) {
                            console.error('WARNING: Database status was not updated!');
                        }
                    }
                }, 500);
                
            } catch (error) {
                console.error('Error updating status:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
                alert('更新状态失败: ' + error.message);
            }
        } else if (password !== null) {
            alert('密码错误');
        }
    }

    // Load and display messages
    function displayMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-item';
        messageDiv.setAttribute('data-message-id', message.id);
        
        const time = new Date(message.created_at);
        const timeString = time.toLocaleString('zh-CN');
        const statusClass = message.status === 1 ? 'status-approved' : 'status-pending';
        
        // Create message HTML with optional image
        const isApproved = message.status === 1;
        const clickHandler = isApproved ? '' : `onclick="window.toggleStatus('${message.id}', ${message.status || 0})"`;
        const titleText = isApproved ? '已审核' : '点击切换状态';
        
        let messageHTML = `
            <div class="message-header">
                <span class="message-username">${message.username}</span>
                <span class="message-time">
                    ${timeString}
                    <span class="status-indicator ${statusClass}" 
                          ${clickHandler}
                          style="${isApproved ? 'cursor: default;' : ''}"
                          title="${titleText}">
                    </span>
                </span>
            </div>
            <div class="message-content">${message.message}</div>
        `;
        
        // Add images if they exist
        if (message.image_url) {
            messageHTML += `
                <div class="message-images-container">
                    <div class="message-image-container">
                        <img src="${message.image_url}" alt="Uploaded image 1" class="message-image clickable-image" data-src="${message.image_url}">
                    </div>`;
            
            if (message.image_url2) {
                messageHTML += `
                    <div class="message-image-container">
                        <img src="${message.image_url2}" alt="Uploaded image 2" class="message-image clickable-image" data-src="${message.image_url2}">
                    </div>`;
            }
            
            messageHTML += `
                </div>`; // Close message-images-container
        }
        
        messageDiv.innerHTML = messageHTML;
        
        // Check if message already exists and update it instead of adding a new one
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) {
            existingMessage.replaceWith(messageDiv);
        } else {
            // Always prepend new messages at the top
            messagesList.insertBefore(messageDiv, messagesList.firstChild);
        }
    }

    // Load messages from Supabase
    async function loadMessages() {
        try {
            messagesList.innerHTML = '<div class="loading">加载中...</div>';
            
            // First, load existing messages
            const { data: messages, error } = await supabase
                .from('messages')
                .select('*')
                //.order('created_at', { ascending: false }) // Newest first
                .limit(50);
            
            if (error) throw error;
            
            messagesList.innerHTML = ''; // Clear loading message
            
            // Display existing messages
            messages.forEach(message => {
                displayMessage(message);
            });
            
            // Set up real-time subscription for new messages
            const channel = supabase
                .channel('messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                    },
                    (payload) => {
                        displayMessage(payload.new);
                    }
                )
                .subscribe();
            
            // Clean up subscription when page unloads
            window.addEventListener('beforeunload', () => {
                supabase.removeChannel(channel);
            });
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesList.innerHTML = '<div class="error">加载消息失败，请刷新重试</div>';
        }
    }
    
    // Initial load of messages
    loadMessages();
    
    // Make toggleStatus available globally
    window.toggleStatus = toggleStatus;
});
