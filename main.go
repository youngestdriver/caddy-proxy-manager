package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed static
var staticFS embed.FS

type Entry struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Group        string   `json:"group"`
	Hosts        []string `json:"hosts"`
	Scheme       string   `json:"scheme"`
	Upstream     string   `json:"upstream"`
	SkipVerify   bool     `json:"skip_verify"`
	ReadTimeout  string   `json:"read_timeout"`
	WriteTimeout string   `json:"write_timeout"`
	Extra        string   `json:"extra"`
	Enabled      bool     `json:"enabled"`
	System       bool     `json:"system"`
}

type ApplyResult struct {
	At  string `json:"at"`
	Ok  bool   `json:"ok"`
	Err string `json:"err"`
}

type Store struct {
	Global    string      `json:"global"`
	SiteHosts string      `json:"site_hosts"`
	TLSBlock  string      `json:"tls_block"`
	Entries   []Entry     `json:"entries"`
	Secret    string      `json:"secret"`
	FileHash  string      `json:"file_hash"`
	LastApply ApplyResult `json:"last_apply"`
}

type Panel struct {
	mu       sync.Mutex
	dir      string
	adminURL string
	password string
	store    Store
}

type Upstream struct {
	Address     string `json:"address"`
	NumRequests int    `json:"num_requests"`
	Fails       int    `json:"fails"`
}

var idRe = regexp.MustCompile(`[^a-zA-Z0-9_]`)

func slug(s string) string {
	s = idRe.ReplaceAllString(strings.ToLower(s), "")
	if s == "" {
		s = "site"
	}
	return s
}

func (p *Panel) caddyfilePath() string { return filepath.Join(p.dir, "Caddyfile") }
func (p *Panel) storePath() string     { return filepath.Join(p.dir, "panel.json") }

func hashText(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func (p *Panel) loadStore() error {
	data, err := os.ReadFile(p.storePath())
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &p.store); err != nil {
		return err
	}
	p.store.normalize()
	return nil
}

// normalize repairs entries that lost their identifier.
func (s *Store) normalize() {
	used := map[string]bool{}
	for _, e := range s.Entries {
		if e.ID != "" {
			used[e.ID] = true
		}
	}
	for i := range s.Entries {
		if s.Entries[i].ID != "" {
			continue
		}
		base := slug(s.Entries[i].Name)
		id := base
		for n := 2; used[id]; n++ {
			id = fmt.Sprintf("%s%d", base, n)
		}
		s.Entries[i].ID = id
		used[id] = true
	}
}

func (p *Panel) saveStoreLocked() error {
	if p.store.Secret == "" {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			return err
		}
		p.store.Secret = hex.EncodeToString(buf)
	}
	data, err := json.MarshalIndent(&p.store, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(p.storePath(), data)
}

func writeFileAtomic(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ---------- Caddy admin API ----------

func (p *Panel) adminPost(path, body string, timeout time.Duration) error {
	req, err := http.NewRequest(http.MethodPost, p.adminURL+path, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "text/caddyfile")
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 Caddy admin API: %v", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s", extractError(data, resp.StatusCode))
	}
	return nil
}

func extractError(data []byte, code int) string {
	var payload struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(data, &payload) == nil && payload.Error != "" {
		return payload.Error
	}
	s := strings.TrimSpace(string(data))
	if s == "" {
		return fmt.Sprintf("Caddy 返回 HTTP %d", code)
	}
	return s
}

func (p *Panel) fetchUpstreams() []Upstream {
	ups := []Upstream{}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(p.adminURL + "/reverse_proxy/upstreams")
	if err != nil {
		return ups
	}
	defer resp.Body.Close()
	json.NewDecoder(resp.Body).Decode(&ups)
	return ups
}

// ---------- render ----------

func indentLines(s string, n int) string {
	prefix := strings.Repeat("\t", n)
	lines := strings.Split(strings.Trim(s, "\n"), "\n")
	for i, l := range lines {
		if strings.TrimSpace(l) == "" {
			lines[i] = ""
			continue
		}
		lines[i] = prefix + strings.TrimLeft(l, " \t")
	}
	return strings.Join(lines, "\n")
}

// indentFirst only shifts the opening line; nested lines keep their own indentation.
func indentFirst(s string, n int) string {
	lines := strings.Split(strings.Trim(s, "\n"), "\n")
	if len(lines) > 0 {
		lines[0] = strings.Repeat("\t", n) + strings.TrimLeft(lines[0], " \t")
	}
	return strings.Join(lines, "\n")
}

// indentBlock shifts the opening and closing lines; body lines keep their indentation.
func indentBlock(s string, n int) string {
	prefix := strings.Repeat("\t", n)
	lines := strings.Split(strings.Trim(s, "\n"), "\n")
	if len(lines) == 0 {
		return s
	}
	lines[0] = prefix + strings.TrimLeft(lines[0], " \t")
	if len(lines) > 1 {
		last := len(lines) - 1
		lines[last] = prefix + strings.TrimLeft(lines[last], " \t")
	}
	return strings.Join(lines, "\n")
}

func render(s *Store) string {
	var b strings.Builder
	g := strings.TrimSpace(s.Global)
	if g != "" {
		if !strings.HasPrefix(g, "{") {
			g = "{\n" + indentLines(g, 1) + "\n}"
		}
		b.WriteString(g)
		b.WriteString("\n\n")
	}
	if strings.TrimSpace(s.SiteHosts) != "" {
		b.WriteString(strings.TrimSpace(s.SiteHosts))
		b.WriteString(" {\n")
	}
	if strings.TrimSpace(s.TLSBlock) != "" {
		b.WriteString(indentBlock(s.TLSBlock, 1))
		b.WriteString("\n")
	}
	for _, e := range s.Entries {
		if !e.Enabled || len(e.Hosts) == 0 || e.Upstream == "" {
			continue
		}
		b.WriteString("\n")
		if e.Name != "" {
			b.WriteString("\t# " + strings.ReplaceAll(e.Name, "\n", " ") + "\n")
		}
		fmt.Fprintf(&b, "\t@%s host %s\n", e.ID, strings.Join(e.Hosts, " "))
		fmt.Fprintf(&b, "\thandle @%s {\n", e.ID)
		target := e.Upstream
		if e.Scheme == "https" {
			target = "https://" + e.Upstream
		}
		if e.SkipVerify || e.ReadTimeout != "" || e.WriteTimeout != "" {
			fmt.Fprintf(&b, "\t\treverse_proxy %s {\n", target)
			b.WriteString("\t\t\ttransport http {\n")
			if e.ReadTimeout != "" {
				fmt.Fprintf(&b, "\t\t\t\tread_timeout %s\n", e.ReadTimeout)
			}
			if e.WriteTimeout != "" {
				fmt.Fprintf(&b, "\t\t\t\twrite_timeout %s\n", e.WriteTimeout)
			}
			if e.SkipVerify {
				b.WriteString("\t\t\t\ttls_insecure_skip_verify\n")
			}
			b.WriteString("\t\t\t}\n\t\t}\n")
		} else {
			fmt.Fprintf(&b, "\t\treverse_proxy %s\n", target)
		}
		if strings.TrimSpace(e.Extra) != "" {
			b.WriteString(indentLines(e.Extra, 2))
			b.WriteString("\n")
		}
		b.WriteString("\t}\n")
	}
	b.WriteString("\n\thandle {\n\t\trespond 404\n\t}\n}\n")
	return b.String()
}

// ---------- parser ----------

// readBlock reads a block whose opening brace is the last character of lines[start].
func readBlock(lines []string, start int) (header string, body []string, next int, err error) {
	t := strings.TrimSpace(lines[start])
	if !strings.HasSuffix(t, "{") {
		return "", nil, start, errors.New("block opener expected")
	}
	header = strings.TrimSpace(strings.TrimSuffix(t, "{"))
	depth := 0
	for i := start; i < len(lines); i++ {
		depth += strings.Count(lines[i], "{") - strings.Count(lines[i], "}")
		if i == start {
			if depth < 1 {
				return "", nil, start, errors.New("bad block")
			}
			continue
		}
		if depth <= 0 {
			if idx := strings.LastIndex(lines[i], "}"); idx >= 0 {
				before := strings.TrimSpace(lines[i][:idx])
				if before != "" {
					body = append(body, before)
				}
			}
			return header, body, i + 1, nil
		}
		body = append(body, lines[i])
	}
	return "", nil, start, errors.New("unclosed block")
}

func cleanBlock(header string, body []string) string {
	var b strings.Builder
	b.WriteString(header)
	b.WriteString(" {\n")
	for _, l := range body {
		b.WriteString(l)
		b.WriteString("\n")
	}
	b.WriteString("}")
	return b.String()
}

func parseProxyBody(body []string, e *Entry) {
	for i := 0; i < len(body); i++ {
		t := strings.TrimSpace(body[i])
		if t == "transport http {" || strings.HasPrefix(t, "transport http ") {
			_, tb, next, err := readBlock(body, i)
			if err == nil {
				for _, l := range tb {
					lt := strings.TrimSpace(l)
					switch {
					case lt == "tls_insecure_skip_verify":
						e.SkipVerify = true
					case strings.HasPrefix(lt, "read_timeout "):
						e.ReadTimeout = strings.TrimSpace(strings.TrimPrefix(lt, "read_timeout "))
					case strings.HasPrefix(lt, "write_timeout "):
						e.WriteTimeout = strings.TrimSpace(strings.TrimPrefix(lt, "write_timeout "))
					}
				}
				i = next - 1
			}
		}
	}
}

func parseHandle(id string, hosts []string, body []string) Entry {
	e := Entry{ID: id, Hosts: hosts, Scheme: "http", Enabled: true}
	var extra []string
	for i := 0; i < len(body); i++ {
		t := strings.TrimSpace(body[i])
		if strings.HasPrefix(t, "reverse_proxy") {
			target := strings.TrimSpace(strings.TrimPrefix(t, "reverse_proxy"))
			if strings.HasSuffix(target, "{") {
				target = strings.TrimSpace(strings.TrimSuffix(target, "{"))
				if _, rb, next, err := readBlock(body, i); err == nil {
					parseProxyBody(rb, &e)
					i = next - 1
				}
			}
			if strings.HasPrefix(target, "https://") {
				e.Scheme = "https"
				target = strings.TrimPrefix(target, "https://")
			} else if strings.HasPrefix(target, "http://") {
				e.Scheme = "http"
				target = strings.TrimPrefix(target, "http://")
			}
			e.Upstream = target
			continue
		}
		if t != "" && !strings.HasPrefix(t, "#") {
			extra = append(extra, strings.TrimLeft(body[i], " \t"))
		}
	}
	e.Extra = strings.Join(extra, "\n")
	e.System = id == "manage"
	return e
}

func nameFromHost(host string) string {
	if i := strings.Index(host, "."); i > 0 {
		return host[:i]
	}
	return host
}

func parseSiteBody(body []string, s *Store) {
	var comment string
	for i := 0; i < len(body); {
		t := strings.TrimSpace(body[i])
		if t == "" {
			i++
			continue
		}
		if strings.HasPrefix(t, "#") {
			comment = strings.TrimSpace(strings.TrimPrefix(t, "#"))
			i++
			continue
		}
		if strings.HasPrefix(t, "tls") && strings.HasSuffix(t, "{") {
			if header, tb, next, err := readBlock(body, i); err == nil {
				s.TLSBlock = cleanBlock(header, tb)
				i = next
				comment = ""
				continue
			}
		}
		if strings.HasPrefix(t, "@") && strings.Contains(t, " host ") {
			fields := strings.Fields(t)
			if len(fields) >= 4 && fields[1] == "host" {
				name := strings.TrimPrefix(fields[0], "@")
				hosts := fields[2:]
				if i+1 < len(body) {
					nt := strings.TrimSpace(body[i+1])
					if strings.HasPrefix(nt, "handle @"+name) && strings.HasSuffix(nt, "{") {
						if _, hb, next, err := readBlock(body, i+1); err == nil {
							e := parseHandle(name, hosts, hb)
							if comment != "" {
								e.Name = comment
							} else {
								e.Name = nameFromHost(hosts[0])
							}
							s.Entries = append(s.Entries, e)
							i = next
							comment = ""
							continue
						}
					}
				}
			}
		}
		i++
	}
}

func parseCaddyfile(text string) (*Store, error) {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	s := &Store{}
	i := 0
	for i < len(lines) && strings.TrimSpace(lines[i]) == "" {
		i++
	}
	if i < len(lines) && strings.HasPrefix(strings.TrimSpace(lines[i]), "{") {
		if header, body, next, err := readBlock(lines, i); err == nil {
			s.Global = cleanBlock(header, body)
			i = next
		}
	}
	for i < len(lines) {
		t := strings.TrimSpace(lines[i])
		if t == "" || strings.HasPrefix(t, "#") {
			i++
			continue
		}
		if strings.HasSuffix(t, "{") {
			header := strings.TrimSpace(strings.TrimSuffix(t, "{"))
			_, body, next, err := readBlock(lines, i)
			if err != nil {
				return nil, err
			}
			s.SiteHosts = header
			parseSiteBody(body, s)
			i = next
			break
		}
		i++
	}
	if s.SiteHosts == "" {
		return nil, errors.New("没有找到站点块")
	}
	if len(s.Entries) == 0 {
		return nil, errors.New("没有解析出任何反代条目")
	}
	return s, nil
}

// ---------- HTTP handlers ----------

func (p *Panel) sign(exp int64) string {
	mac := hmac.New(sha256.New, []byte(p.store.Secret))
	fmt.Fprintf(mac, "%d", exp)
	return fmt.Sprintf("%d.%s", exp, hex.EncodeToString(mac.Sum(nil)))
}

func (p *Panel) validCookie(r *http.Request) bool {
	c, err := r.Cookie("panel_token")
	if err != nil {
		return false
	}
	parts := strings.SplitN(c.Value, ".", 2)
	if len(parts) != 2 {
		return false
	}
	exp, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	expect := p.sign(exp)
	return subtle.ConstantTimeCompare([]byte(expect), []byte(c.Value)) == 1
}

func (p *Panel) writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func (p *Panel) writeErr(w http.ResponseWriter, code int, msg string) {
	p.writeJSON(w, code, map[string]string{"error": msg})
}

func (p *Panel) apiLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		p.writeErr(w, 400, "请求格式错误")
		return
	}
	if p.password == "" || subtle.ConstantTimeCompare([]byte(body.Password), []byte(p.password)) != 1 {
		time.Sleep(400 * time.Millisecond)
		p.writeErr(w, 401, "口令错误")
		return
	}
	exp := time.Now().Add(7 * 24 * time.Hour).Unix()
	http.SetCookie(w, &http.Cookie{
		Name:     "panel_token",
		Value:    p.sign(exp),
		Path:     "/",
		Expires:  time.Unix(exp, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.Header.Get("X-Forwarded-Proto") == "https",
	})
	p.writeJSON(w, 200, map[string]bool{"ok": true})
}

func (p *Panel) apiLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "panel_token", Value: "", Path: "/", MaxAge: -1})
	p.writeJSON(w, 200, map[string]bool{"ok": true})
}

func (p *Panel) apiState(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	s := p.store
	p.mu.Unlock()

	drift := false
	if data, err := os.ReadFile(p.caddyfilePath()); err == nil {
		drift = s.FileHash != "" && hashText(string(data)) != s.FileHash
	}
	type state struct {
		Entries   []Entry     `json:"entries"`
		Upstreams []Upstream  `json:"upstreams"`
		Drift     bool        `json:"drift"`
		Version   string      `json:"version"`
		SiteHosts string      `json:"site_hosts"`
		Global    string      `json:"global"`
		LastApply ApplyResult `json:"last_apply"`
	}
	p.writeJSON(w, 200, state{
		Entries:   s.Entries,
		Upstreams: p.fetchUpstreams(),
		Drift:     drift,
		Version:   os.Getenv("CADDY_VERSION"),
		SiteHosts: s.SiteHosts,
		Global:    s.Global,
		LastApply: s.LastApply,
	})
}

func (p *Panel) applyLocked() error {
	text := render(&p.store)
	if err := p.adminPost("/adapt", text, 20*time.Second); err != nil {
		p.store.LastApply = ApplyResult{At: time.Now().Format(time.RFC3339), Ok: false, Err: err.Error()}
		p.saveStoreLocked()
		return err
	}
	if err := p.adminPost("/load", text, 60*time.Second); err != nil {
		// On this router Caddy can take ~20s to answer /load because it
		// restarts its own admin endpoint while our request is in flight.
		// A second identical load returns at once ("config is unchanged")
		// if the first one already took effect.
		if retryErr := p.adminPost("/load", text, 20*time.Second); retryErr != nil {
			p.store.LastApply = ApplyResult{At: time.Now().Format(time.RFC3339), Ok: false, Err: err.Error()}
			p.saveStoreLocked()
			return err
		}
	}
	if data, err := os.ReadFile(p.caddyfilePath()); err == nil {
		backup := fmt.Sprintf("%s.bak-%s", p.caddyfilePath(), time.Now().Format("20060102-150405"))
		os.WriteFile(backup, data, 0o644)
	}
	if err := writeFileAtomic(p.caddyfilePath(), []byte(text)); err != nil {
		return fmt.Errorf("配置已生效，但写回文件失败: %v", err)
	}
	p.store.FileHash = hashText(text)
	p.store.LastApply = ApplyResult{At: time.Now().Format(time.RFC3339), Ok: true}
	p.saveStoreLocked()
	return nil
}

// saveConfigLocked writes the rendered Caddyfile without reloading Caddy.
// Used for panel-only changes such as entry ordering, where the order in
// the running config has no effect on request handling.
func (p *Panel) saveConfigLocked() error {
	text := render(&p.store)
	if err := writeFileAtomic(p.caddyfilePath(), []byte(text)); err != nil {
		return err
	}
	p.store.FileHash = hashText(text)
	return p.saveStoreLocked()
}

func (p *Panel) apiCreateEntry(w http.ResponseWriter, r *http.Request) {
	var e Entry
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		p.writeErr(w, 400, "请求格式错误")
		return
	}
	e.Hosts = cleanHosts(e.Hosts)
	if e.Name == "" && len(e.Hosts) > 0 {
		e.Name = nameFromHost(e.Hosts[0])
	}
	if e.ID == "" {
		e.ID = slug(e.Name)
	}
	if e.Scheme == "" {
		e.Scheme = "http"
	}
	if len(e.Hosts) == 0 || e.Upstream == "" {
		p.writeErr(w, 400, "域名和上游不能为空")
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, x := range p.store.Entries {
		if x.ID == e.ID {
			p.writeErr(w, 400, "名称冲突，请换一个名称")
			return
		}
	}
	p.store.Entries = append(p.store.Entries, e)
	if err := p.applyLocked(); err != nil {
		p.store.Entries = p.store.Entries[:len(p.store.Entries)-1]
		p.saveStoreLocked()
		p.writeErr(w, 400, err.Error())
		return
	}
	p.writeJSON(w, 200, map[string]interface{}{"ok": true, "entry": e})
}

func findEntry(entries []Entry, id string) int {
	for i, e := range entries {
		if e.ID == id {
			return i
		}
	}
	return -1
}

func (p *Panel) apiUpdateEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var e Entry
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		p.writeErr(w, 400, "请求格式错误")
		return
	}
	e.Hosts = cleanHosts(e.Hosts)
	e.ID = id
	if e.Scheme == "" {
		e.Scheme = "http"
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	idx := findEntry(p.store.Entries, id)
	if idx < 0 {
		p.writeErr(w, 404, "条目不存在")
		return
	}
	if p.store.Entries[idx].System {
		e.System = true
	}
	if len(e.Hosts) == 0 || e.Upstream == "" {
		p.writeErr(w, 400, "域名和上游不能为空")
		return
	}
	old := p.store.Entries[idx]
	p.store.Entries[idx] = e
	if err := p.applyLocked(); err != nil {
		p.store.Entries[idx] = old
		p.saveStoreLocked()
		p.writeErr(w, 400, err.Error())
		return
	}
	p.writeJSON(w, 200, map[string]interface{}{"ok": true, "entry": e})
}

func (p *Panel) apiDeleteEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p.mu.Lock()
	defer p.mu.Unlock()
	idx := findEntry(p.store.Entries, id)
	if idx < 0 {
		p.writeErr(w, 404, "条目不存在")
		return
	}
	if p.store.Entries[idx].System {
		p.writeErr(w, 400, "系统条目不能删除")
		return
	}
	old := p.store.Entries
	entry := p.store.Entries[idx]
	p.store.Entries = append(append([]Entry{}, p.store.Entries[:idx]...), p.store.Entries[idx+1:]...)
	if err := p.applyLocked(); err != nil {
		p.store.Entries = old
		p.saveStoreLocked()
		p.writeErr(w, 400, err.Error())
		return
	}
	p.writeJSON(w, 200, map[string]interface{}{"ok": true, "deleted": entry.ID})
}

func (p *Panel) apiPreview(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	text := render(&p.store)
	p.mu.Unlock()
	p.writeJSON(w, 200, map[string]string{"caddyfile": text})
}

func (p *Panel) apiImport(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(p.caddyfilePath())
	if err != nil {
		p.writeErr(w, 500, "读取 Caddyfile 失败: "+err.Error())
		return
	}
	st, err := parseCaddyfile(string(data))
	if err != nil {
		p.writeErr(w, 400, "解析失败: "+err.Error())
		return
	}
	p.mu.Lock()
	st.Secret = p.store.Secret
	st.LastApply = p.store.LastApply
	old := p.store.Entries
	p.store = *st
	p.store.normalize()
	for i := range p.store.Entries {
		for _, e := range old {
			if e.ID == p.store.Entries[i].ID {
				p.store.Entries[i].Group = e.Group
				break
			}
		}
	}
	p.store.FileHash = hashText(string(data))
	err = p.saveStoreLocked()
	p.mu.Unlock()
	if err != nil {
		p.writeErr(w, 500, err.Error())
		return
	}
	p.writeJSON(w, 200, map[string]interface{}{"ok": true, "count": len(st.Entries)})
}

func (p *Panel) apiReorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		p.writeErr(w, 400, "请求格式错误")
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(body.IDs) != len(p.store.Entries) {
		p.writeErr(w, 400, "条目列表不匹配")
		return
	}
	byID := make(map[string]Entry, len(p.store.Entries))
	for _, e := range p.store.Entries {
		byID[e.ID] = e
	}
	out := make([]Entry, 0, len(body.IDs))
	seen := map[string]bool{}
	for _, id := range body.IDs {
		e, ok := byID[id]
		if !ok || seen[id] {
			p.writeErr(w, 400, "条目列表不匹配")
			return
		}
		seen[id] = true
		out = append(out, e)
	}
	old := p.store.Entries
	p.store.Entries = out
	if err := p.saveConfigLocked(); err != nil {
		p.store.Entries = old
		p.saveStoreLocked()
		p.writeErr(w, 500, err.Error())
		return
	}
	p.writeJSON(w, 200, map[string]bool{"ok": true})
}

func (p *Panel) apiDownload(w http.ResponseWriter, r *http.Request) {
	data, err := os.ReadFile(p.caddyfilePath())
	if err != nil {
		p.writeErr(w, 500, err.Error())
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="Caddyfile"`)
	w.Write(data)
}

func cleanHosts(in []string) []string {
	var out []string
	seen := map[string]bool{}
	for _, h := range in {
		for _, part := range strings.FieldsFunc(h, func(r rune) bool {
			return r == ',' || r == ' ' || r == '\n' || r == '\r' || r == '\t'
		}) {
			part = strings.TrimSpace(part)
			if part == "" || seen[part] {
				continue
			}
			seen[part] = true
			out = append(out, part)
		}
	}
	return out
}

func main() {
	listen := flag.String("listen", "127.0.0.1:8081", "listen address")
	dir := flag.String("dir", "/etc/caddy", "directory containing Caddyfile")
	admin := flag.String("admin", "http://127.0.0.1:2019", "caddy admin api url")
	password := flag.String("password", "", "管理口令（也可用 PANEL_PASSWORD 环境变量）")
	flag.Parse()

	pw := *password
	if pw == "" {
		pw = os.Getenv("PANEL_PASSWORD")
	}
	p := &Panel{
		dir:      *dir,
		adminURL: strings.TrimRight(*admin, "/"),
		password: pw,
	}

	if err := p.loadStore(); err != nil {
		// first run: import the existing Caddyfile
		if data, ferr := os.ReadFile(p.caddyfilePath()); ferr == nil {
			st, perr := parseCaddyfile(string(data))
			if perr != nil {
				log.Printf("首次导入失败，面板不接管配置: %v", perr)
			} else {
				st.normalize()
				st.FileHash = hashText(string(data))
				p.store = *st
				if err := p.saveStoreLocked(); err != nil {
					log.Printf("写入 panel.json 失败: %v", err)
				}
				log.Printf("首次导入成功，共 %d 条", len(st.Entries))
			}
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/login", p.apiLogin)
	mux.HandleFunc("POST /api/logout", p.apiLogout)

	auth := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if !p.validCookie(r) {
				p.writeErr(w, 401, "未登录")
				return
			}
			h(w, r)
		}
	}
	mux.HandleFunc("GET /api/state", auth(p.apiState))
	mux.HandleFunc("POST /api/entries", auth(p.apiCreateEntry))
	mux.HandleFunc("PUT /api/entries/{id}", auth(p.apiUpdateEntry))
	mux.HandleFunc("DELETE /api/entries/{id}", auth(p.apiDeleteEntry))
	mux.HandleFunc("GET /api/preview", auth(p.apiPreview))
	mux.HandleFunc("POST /api/import", auth(p.apiImport))
	mux.HandleFunc("POST /api/reorder", auth(p.apiReorder))
	mux.HandleFunc("GET /api/caddyfile", auth(p.apiDownload))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(sub))
	mux.Handle("/static/", http.StripPrefix("/static/", fileServer))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		data, err := fs.ReadFile(sub, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(data)
	})

	log.Printf("caddy-panel listening on %s, dir=%s, admin=%s", *listen, *dir, *admin)
	if err := http.ListenAndServe(*listen, mux); err != nil {
		log.Fatal(err)
	}
}
