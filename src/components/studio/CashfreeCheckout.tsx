import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { CashfreeOrder } from '../../lib/partnerApi';
import { c } from '../professional/onboardingUi';

// The Cashfree JS SDK only runs in a browser context, so the app hosts it in a WebView — the same
// drop-in checkout the website opens. Closing this view proves nothing: the caller must verify the
// order with the backend afterwards.
const html = (order: CashfreeOrder) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#f6f8f7;display:flex;align-items:center;justify-content:center;height:100vh;color:#10231c}</style>
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script></head><body><p>Opening secure checkout...</p>
<script>
  function send(t){window.ReactNativeWebView.postMessage(t)}
  window.onload=function(){
    try{
      var cf=Cashfree({mode:${JSON.stringify(order.environment)}});
      cf.checkout({paymentSessionId:${JSON.stringify(order.paymentSessionId)},redirectTarget:'_modal'}).then(function(){send('done')}).catch(function(){send('done')});
    }catch(e){send('error')}
  };
</script></body></html>`;

export function CashfreeCheckout({ order, onClose }: { order: CashfreeOrder | null; onClose: () => void }) {
  return (
    <Modal visible={!!order} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.bar}>
          <Text style={s.title}>Secure payment</Text>
          <Pressable hitSlop={10} onPress={onClose}><Text style={s.close}>Close</Text></Pressable>
        </View>
        {order && (
          <WebView
            source={{ html: html(order), baseUrl: 'https://sdk.cashfree.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onMessage={() => onClose()}
            // UPI / wallet apps open through their own URL schemes.
            onShouldStartLoadWithRequest={request => {
              if (/^https?:|^about:|^data:/i.test(request.url)) return true;
              void Linking.openURL(request.url).catch(() => undefined);
              return false;
            }}
            style={{ flex: 1 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: c.line },
  title: { fontSize: 15, fontWeight: '800', color: c.ink },
  close: { fontSize: 13, fontWeight: '800', color: c.green },
});
