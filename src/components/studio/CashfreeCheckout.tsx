import { useEffect, useRef } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { CashfreeOrder } from '../../lib/partnerApi';
import { c } from '../professional/onboardingUi';
import { isPaymentReturn } from '../../lib/paymentReturn';

// The Cashfree JS SDK only runs in a browser context, so the app hosts it in a WebView — the same
// drop-in checkout the website opens. Closing this view proves nothing: the caller must verify the
// order with the backend afterwards.
// Cashfree's modal checkout opens a pop-up window for the card, wallet and bank steps. A WebView
// cannot show that pop-up, so the payment failed and this view closed straight away (only in the app:
// a browser allows pop-ups). Cashfree's full-page checkout keeps every step in this one view and ends
// by sending the buyer to the website's payment return page, which is how this view knows it is over.
const html = (order: CashfreeOrder) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#f6f8f7;display:flex;align-items:center;justify-content:center;height:100vh;color:#10231c}</style>
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script></head><body><p>Opening secure checkout...</p>
<script>
  function send(t){window.ReactNativeWebView.postMessage(t)}
  window.onload=function(){
    try{
      var cf=Cashfree({mode:${JSON.stringify(order.environment)}});
      // Page navigation is the normal way out of this checkout, so only a failure to start it is reported.
      cf.checkout({paymentSessionId:${JSON.stringify(order.paymentSessionId)},redirectTarget:'_self'}).then(function(r){if(r&&r.error)send('error')}).catch(function(){send('error')});
    }catch(e){send('error')}
  };
</script></body></html>`;

export function CashfreeCheckout({ order, onClose }: { order: CashfreeOrder | null; onClose: () => void }) {
  // Closes once, however the checkout ends (return page, error message, or the system back gesture).
  const finished = useRef(false);
  useEffect(() => { finished.current = false; }, [order?.orderId]);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onClose();
  };
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
            onMessage={() => finish()}
            // UPI / wallet apps open through their own URL schemes.
            onShouldStartLoadWithRequest={request => {
              if (isPaymentReturn(request.url, order?.returnUrl)) { finish(); return false; }
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
  title: { fontSize: 14.5, fontWeight: '800', color: c.ink },
  close: { fontSize: 13, fontWeight: '800', color: c.green },
});
