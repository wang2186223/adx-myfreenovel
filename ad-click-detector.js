// ===== 独立广告点击检测系统 =====
// 纯监控上报，不干扰任何现有逻辑

class AdClickDetector {
    constructor() {
        // 检测PC环境，只在移动端运行
        this.isMobile = this.detectMobile();
        
        if (!this.isMobile) {
            console.log('Ad Click Detector: PC环境，不启动检测');
            return;
        }
        
        // 配置
        this.REPORT_URL = 'https://script.google.com/macros/s/AKfycbzAUUO8RgiDJj3SYAt7Nd35ZzHw04VYGR88Nq4GFmAbl1xYmmkE9ArzD8x6mF_yYcf00A/exec';
        
        // 获取历史累计点击次数（永久累加）
        this.totalClickCount = this.getTotalClickCount();
        
        // 当前页面触摸状态
        this.touchData = {
            startTime: 0,
            startX: 0,
            startY: 0,
            isTouching: false,
            moved: false,
            adElement: null
        };
        
        this.init();
    }
    
    // 检测是否为移动设备
    detectMobile() {
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod'];
        const isMobile = mobileKeywords.some(keyword => userAgent.includes(keyword));
        const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.screen.width < 1024;
        
        return isMobile || hasTouchScreen || isSmallScreen;
    }
    
    // 获取历史累计点击次数
    getTotalClickCount() {
        const stored = localStorage.getItem('adClickTotalCount');
        return stored ? parseInt(stored) : 0;
    }
    
    // 保存累计点击次数
    saveTotalClickCount() {
        localStorage.setItem('adClickTotalCount', this.totalClickCount.toString());
    }
    
    // 初始化检测
    init() {
        console.log('Ad Click Detector: 初始化完成，历史累计点击:', this.totalClickCount);
        this.setupAdMonitoring();
    }
    
    // 监控所有广告容器
    setupAdMonitoring() {
        // 定期检查新广告
        const checkForAds = () => {
            const adElements = document.querySelectorAll('[id^="div-gpt-ad-"]');
            adElements.forEach(ad => {
                if (!ad.dataset.clickDetectorMonitored) {
                    ad.dataset.clickDetectorMonitored = 'true';
                    this.attachClickDetection(ad);
                }
            });
        };
        
        checkForAds();
        setInterval(checkForAds, 2000);
    }
    
    // 为广告元素附加点击检测
    attachClickDetection(adElement) {
        // 触摸开始
        adElement.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.touchData = {
                startTime: Date.now(),
                startX: touch.clientX,
                startY: touch.clientY,
                isTouching: true,
                moved: false,
                adElement: adElement
            };
        }, { passive: true });
        
        // 触摸移动（检测是否滑动）
        adElement.addEventListener('touchmove', (e) => {
            if (!this.touchData.isTouching) return;
            
            const touch = e.touches[0];
            const moveX = Math.abs(touch.clientX - this.touchData.startX);
            const moveY = Math.abs(touch.clientY - this.touchData.startY);
            
            // 移动超过10px视为滑动
            if (moveX > 10 || moveY > 10) {
                this.touchData.moved = true;
            }
        }, { passive: true });
        
        // 触摸结束
        adElement.addEventListener('touchend', (e) => {
            if (!this.touchData.isTouching) return;
            
            const touchDuration = Date.now() - this.touchData.startTime;
            
            // 点击判定：未移动 + 持续时间50-500ms
            if (!this.touchData.moved && touchDuration > 50 && touchDuration < 500) {
                this.onAdClickDetected('touchend', adElement, touchDuration);
            }
            
            this.touchData.isTouching = false;
        }, { passive: true });
        
        // 触摸取消
        adElement.addEventListener('touchcancel', () => {
            this.touchData.isTouching = false;
        }, { passive: true });
        
        // 页面失焦检测（广告跳转）
        const blurHandler = () => {
            if (this.touchData.isTouching && this.touchData.adElement === adElement) {
                this.onAdClickDetected('blur', adElement, 0);
            }
        };
        window.addEventListener('blur', blurHandler);
        
        // 页面可见性变化（切换应用/标签页）
        const visibilityHandler = () => {
            if (document.hidden && this.touchData.isTouching && this.touchData.adElement === adElement) {
                this.onAdClickDetected('visibilitychange', adElement, 0);
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);
    }
    
    // 检测到广告点击
    onAdClickDetected(method, adElement, duration) {
        // 累加点击次数
        this.totalClickCount++;
        this.saveTotalClickCount();
        
        console.log(`🎯 Ad Click Detector: 检测到广告点击！第${this.totalClickCount}次 (方式:${method}, 耗时:${duration}ms)`);
        
        // 上报数据
        this.reportAdClick(method, adElement);
    }
    
    // 上报广告点击事件
    async reportAdClick(detectionMethod, adElement) {
        try {
            // 获取IP地址
            const userIP = await this.getUserIP();
            
            // 获取设备信息
            const deviceInfo = this.getDeviceInfo();
            
            const data = {
                eventType: 'ad_click_detected',
                page: window.location.href,
                deviceInfo: deviceInfo,
                userIP: userIP,
                totalClickCount: this.totalClickCount,
                detectionMethod: detectionMethod,
                adElementId: adElement.id || 'unknown',
                timestamp: new Date().toISOString()
            };
            
            console.log('Ad Click Detector: 上报数据', data);
            
            fetch(this.REPORT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            }).then(() => {
                console.log('Ad Click Detector: 上报成功');
            }).catch(error => {
                console.log('Ad Click Detector: 上报失败', error);
            });
            
        } catch (error) {
            console.error('Ad Click Detector: 上报异常', error);
        }
    }
    
    // 获取用户IP
    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json', {
                method: 'GET',
                cache: 'no-cache'
            });
            const data = await response.json();
            return data.ip || 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }
    
    // 获取设备信息
    getDeviceInfo() {
        const ua = navigator.userAgent;
        const platform = navigator.platform || 'Unknown';
        const screenSize = `${window.screen.width}x${window.screen.height}`;
        
        // 简化的设备信息
        let deviceType = 'Unknown';
        if (/iPhone/.test(ua)) deviceType = 'iPhone';
        else if (/iPad/.test(ua)) deviceType = 'iPad';
        else if (/Android/.test(ua)) deviceType = 'Android';
        
        return `${deviceType} | ${platform} | ${screenSize}`;
    }
}

// 自动初始化（页面加载完成后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adClickDetector = new AdClickDetector();
    });
} else {
    window.adClickDetector = new AdClickDetector();
}
