#import <React/RCTBridgeModule.h>
#import <WebKit/WebKit.h>
#import <UIKit/UIKit.h>
#import <Security/Security.h>
#import <CommonCrypto/CommonDigest.h>
#import "HetingEngine.h"

@interface PersonalMusic : NSObject <RCTBridgeModule>
@property(nonatomic, strong) dispatch_queue_t io;
@property(nonatomic, copy) NSString *sessionKey;
@property(nonatomic) NSInteger port;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *> *states;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *epochs;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSString *> *fingerprints;
@end

@implementation PersonalMusic
RCT_EXPORT_MODULE(PersonalMusic)
+ (BOOL)requiresMainQueueSetup { return YES; }
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

static NSString *RandomKey(void) {
    uint8_t bytes[32];
    if (SecRandomCopyBytes(kSecRandomDefault, sizeof(bytes), bytes) != errSecSuccess) { return nil; }
    NSString *key = [[NSData dataWithBytes:bytes length:sizeof(bytes)] base64EncodedStringWithOptions:0];
    return [[key stringByReplacingOccurrencesOfString:@"+" withString:@"-"] stringByReplacingOccurrencesOfString:@"/" withString:@"_"];
}
static NSString *Hash(NSString *value) {
    NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
    unsigned char digest[CC_SHA256_DIGEST_LENGTH]; CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
    NSMutableString *result = [NSMutableString string];
    for (NSUInteger i = 0; i < sizeof(digest); i++) { [result appendFormat:@"%02x", digest[i]]; }
    return result;
}
static NSArray<NSString *> *Hosts(NSString *source) {
    if ([source isEqualToString:@"netease"]) { return @[@"music.163.com", @"y.music.163.com"]; }
    if ([source isEqualToString:@"qq"]) { return @[@"y.qq.com", @"graph.qq.com", @"xui.ptlogin2.qq.com", @"c.y.qq.com"]; }
    return @[];
}
static BOOL IsPlatformCookie(NSHTTPCookie *cookie, NSString *source) {
    NSString *domain = cookie.domain.lowercaseString;
    if ([domain hasPrefix:@"."]) { domain = [domain substringFromIndex:1]; }
    for (NSString *host in Hosts(source)) {
        if ([host isEqualToString:domain] || [host hasSuffix:[@"." stringByAppendingString:domain]]) { return YES; }
    }
    return NO;
}
static NSString *Query(NSURLComponents *url, NSString *key) {
    for (NSURLQueryItem *item in url.queryItems) { if ([item.name isEqualToString:key]) { return item.value ?: @""; } }
    return @"";
}
- (instancetype)init {
    if ((self = [super init])) {
        _io = dispatch_queue_create("fun.upup.heting.personal-music", DISPATCH_QUEUE_SERIAL);
        _sessionKey = RandomKey(); _states = [NSMutableDictionary dictionary];
        _epochs = [NSMutableDictionary dictionary]; _fingerprints = [NSMutableDictionary dictionary];
    }
    return self;
}
- (NSUInteger)epoch:(NSString *)source { @synchronized(self) { return self.epochs[source].unsignedIntegerValue; } }
- (NSInteger)ensureEngine {
    if (self.port > 0) { return self.port; }
    if (self.sessionKey.length < 32) { return -1; }
    NSError *error = nil;
    NSURL *base = [[NSFileManager defaultManager] URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:&error];
    if (!base || error) { return -1; }
    NSURL *directory = [base URLByAppendingPathComponent:@"personal-music" isDirectory:YES];
    NSDictionary *attributes = @{NSFilePosixPermissions: @0700, NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication};
    if (![[NSFileManager defaultManager] createDirectoryAtURL:directory withIntermediateDirectories:YES attributes:attributes error:&error]) { return -1; }
    [directory setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
    NSString *file = [[directory URLByAppendingPathComponent:@"sessions.json"] path];
    self.port = HetingEngineStart((char *)self.sessionKey.UTF8String, (char *)file.UTF8String);
    return self.port;
}
// Called only on the serial IO queue; never blocks the UI or WebKit cookie store.
- (NSInteger)request:(NSString *)path method:(NSString *)method body:(NSDictionary *)body {
    NSInteger port = [self ensureEngine]; if (port <= 0) { return -1; }
    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%ld%@", (long)port, path]];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:35];
    request.HTTPMethod = method;
    [request setValue:[@"Bearer " stringByAppendingString:self.sessionKey] forHTTPHeaderField:@"Authorization"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    if (body) { request.HTTPBody = [NSJSONSerialization dataWithJSONObject:body options:0 error:nil]; }
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    __block NSInteger status = -1;
    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (!error && [response isKindOfClass:NSHTTPURLResponse.class]) { status = ((NSHTTPURLResponse *)response).statusCode; }
        dispatch_semaphore_signal(done);
    }];
    [task resume];
    if (dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, 40 * NSEC_PER_SEC)) != 0) { [task cancel]; return -1; }
    return status;
}

RCT_REMAP_METHOD(connection, connectionWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(self.io, ^{
        NSInteger port = [self ensureEngine];
        if (port <= 0) { reject(@"ENGINE_UNAVAILABLE", @"内置音乐模块未能启动，请重新打开合听", nil); return; }
        resolve(@{@"baseUrl": [NSString stringWithFormat:@"http://127.0.0.1:%ld", (long)port], @"token": self.sessionKey});
    });
}
RCT_EXPORT_METHOD(beginLogin:(NSString *)source webPassword:(BOOL)webPassword resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (!Hosts(source).count) { reject(@"PLATFORM", @"不支持的音乐平台", nil); return; }
    NSString *state = RandomKey();
    if (!state) { reject(@"LOGIN_STATE", @"无法创建登录验证，请重试", nil); return; }
    @synchronized(self) { self.epochs[source] = @([self epoch:source] + 1); self.states[source] = state; }
    NSString *address = @"https://music.163.com/m/login";
    if ([source isEqualToString:@"qq"]) {
        NSURLComponents *url = [NSURLComponents componentsWithString:@"https://graph.qq.com/oauth2.0/authorize"];
        url.queryItems = @[[NSURLQueryItem queryItemWithName:@"response_type" value:@"code"],
            [NSURLQueryItem queryItemWithName:@"client_id" value:@"100497308"],
            [NSURLQueryItem queryItemWithName:@"redirect_uri" value:@"https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F"],
            [NSURLQueryItem queryItemWithName:@"state" value:state],
            [NSURLQueryItem queryItemWithName:@"display" value:webPassword ? @"pc" : @"mobile"],
            [NSURLQueryItem queryItemWithName:@"scope" value:@"get_user_info"]];
        address = url.URL.absoluteString;
    }
    resolve(@{@"url": address});
}
RCT_EXPORT_METHOD(captureSession:(NSString *)source navigationURL:(NSString *)navigationURL resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (!Hosts(source).count) { reject(@"PLATFORM", @"不支持的音乐平台", nil); return; }
    NSUInteger epoch = [self epoch:source];
    NSURLComponents *url = [NSURLComponents componentsWithString:navigationURL];
    BOOL callback = [source isEqualToString:@"qq"] && [url.scheme isEqualToString:@"https"] && [url.host isEqualToString:@"y.qq.com"] && [url.path isEqualToString:@"/portal/wx_redirect.html"];
    NSString *code = callback ? Query(url, @"code") : @"";
    @synchronized(self) {
        if (code.length && ![Query(url, @"state") isEqualToString:self.states[source]]) { reject(@"LOGIN_STATE", @"登录已过期，请重新打开登录页", nil); return; }
    }
    [[WKWebsiteDataStore defaultDataStore].httpCookieStore getAllCookies:^(NSArray<NSHTTPCookie *> *cookies) {
        NSMutableDictionary<NSString *, NSString *> *values = [NSMutableDictionary dictionary];
        for (NSHTTPCookie *cookie in cookies) {
            if (IsPlatformCookie(cookie, source) && [cookie.path isEqualToString:@"/"]) { values[cookie.name] = cookie.value; }
        }
        BOOL ready = [source isEqualToString:@"netease"] ? [values[@"MUSIC_U"] length] > 0 : code.length > 0;
        if ([source isEqualToString:@"qq"]) { for (NSString *name in @[@"qm_keyst", @"qqmusic_key", @"music_key", @"musickey"]) { ready |= [values[name] length] > 0; } }
        if (!ready) { resolve(@{@"connected": @NO}); return; }
        NSMutableArray *pairs = [NSMutableArray array];
        for (NSString *name in [[values allKeys] sortedArrayUsingSelector:@selector(compare:)]) { [pairs addObject:[NSString stringWithFormat:@"%@=%@", name, values[name]]]; }
        NSString *cookie = [pairs componentsJoinedByString:@"; "];
        NSString *fingerprint = Hash([cookie stringByAppendingString:code]);
        dispatch_async(self.io, ^{
            if (epoch != [self epoch:source]) { resolve(@{@"connected": @NO}); return; }
            BOOL same; @synchronized(self) { same = [self.fingerprints[source] isEqualToString:fingerprint]; }
            NSString *path = [NSString stringWithFormat:@"/api/v1/system/accounts/%@/session", source];
            NSInteger status = same ? 200 : [self request:path method:@"POST" body:@{@"cookie":cookie, @"code":code}];
            if (epoch != [self epoch:source]) {
                if (status == 200) { [self request:[NSString stringWithFormat:@"/api/v1/system/accounts/%@", source] method:@"DELETE" body:nil]; }
                resolve(@{@"connected": @NO}); return;
            }
            if (status == 200) { @synchronized(self) { self.fingerprints[source] = fingerprint; } resolve(@{@"connected": @YES}); }
            else if (status == 401) { resolve(@{@"connected": @NO}); }
            else { reject(@"ACCOUNT_NETWORK", @"账号暂时未能连接，请检查网络后重试", nil); }
        });
    }];
}
RCT_EXPORT_METHOD(cancelLogin:(NSString *)source) {
    @synchronized(self) { self.epochs[source] = @([self epoch:source] + 1); [self.states removeObjectForKey:source]; }
}
RCT_EXPORT_METHOD(logout:(NSString *)source resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (!Hosts(source).count) { reject(@"PLATFORM", @"不支持的音乐平台", nil); return; }
    @synchronized(self) { self.epochs[source] = @([self epoch:source]+1); [self.states removeObjectForKey:source]; [self.fingerprints removeObjectForKey:source]; }
    dispatch_async(self.io, ^{
        if ([self request:[NSString stringWithFormat:@"/api/v1/system/accounts/%@", source] method:@"DELETE" body:nil] != 200) { reject(@"LOGOUT", @"退出登录失败，请重试", nil); return; }
        dispatch_async(dispatch_get_main_queue(), ^{
            NSHTTPCookieStorage *shared = [NSHTTPCookieStorage sharedHTTPCookieStorage];
            for (NSHTTPCookie *cookie in shared.cookies) { if (IsPlatformCookie(cookie, source)) { [shared deleteCookie:cookie]; } }
            WKHTTPCookieStore *store = [WKWebsiteDataStore defaultDataStore].httpCookieStore;
            [store getAllCookies:^(NSArray<NSHTTPCookie *> *cookies) {
                dispatch_group_t group = dispatch_group_create();
                for (NSHTTPCookie *cookie in cookies) {
                    if (!IsPlatformCookie(cookie, source)) { continue; }
                    dispatch_group_enter(group); [store deleteCookie:cookie completionHandler:^{ dispatch_group_leave(group); }];
                }
                dispatch_group_notify(group, dispatch_get_main_queue(), ^{ resolve(nil); });
            }];
        });
    });
}
RCT_EXPORT_METHOD(openQQLoginApp:(NSString *)address origin:(NSString *)origin resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    NSURLComponents *page = [NSURLComponents componentsWithString:origin];
    NSURLComponents *url = [NSURLComponents componentsWithString:address];
    NSString *ticket = Query(url, @"p"); if (!ticket.length) { ticket = Query(url, @"qrcode"); }
    NSURL *target = [NSURL URLWithString:ticket];
    BOOL active; @synchronized(self) { active = self.states[@"qq"] != nil; }
    BOOL originOK = [page.scheme isEqualToString:@"https"] && ([page.host isEqualToString:@"qq.com"] || [page.host hasSuffix:@".qq.com"]);
    if (!active || !originOK || ![@[@"wtloginmqq", @"wtloginmqq2", @"wtloginmqq3"] containsObject:url.scheme] || ![url.host isEqualToString:@"ptlogin"] || ![url.path isEqualToString:@"/qlogin"] || ![target.scheme isEqualToString:@"https"] || ![@[@"ssl.ptlogin2.qq.com", @"xui.ptlogin2.qq.com"] containsObject:target.host]) {
        reject(@"QQ_LINK", @"请从当前 QQ 官方登录页面发起授权", nil); return;
    }
    NSMutableArray *items = [NSMutableArray array];
    for (NSURLQueryItem *item in url.queryItems) { if (![item.name isEqualToString:@"schemacallback"]) { [items addObject:item]; } }
    [items addObject:[NSURLQueryItem queryItemWithName:@"schemacallback" value:@"heting://qq-login"]]; url.queryItems = items;
    [[UIApplication sharedApplication] openURL:url.URL options:@{} completionHandler:^(BOOL success) {
        if (success) { resolve(nil); } else { reject(@"QQ_OPEN", @"未能打开手机 QQ，请使用网页账号密码登录", nil); }
    }];
}
@end
