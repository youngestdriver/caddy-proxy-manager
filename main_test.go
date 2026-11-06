package main

import (
	"os"
	"testing"
)

func TestParseCurrentCaddyfile(t *testing.T) {
	data, err := os.ReadFile("testdata/Caddyfile")
	if err != nil {
		t.Fatal(err)
	}
	st, err := parseCaddyfile(string(data))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(st.Entries) < 20 {
		t.Fatalf("expected >=20 entries, got %d", len(st.Entries))
	}
	if st.SiteHosts == "" || st.Global == "" || st.TLSBlock == "" {
		t.Fatalf("missing global/site/tls: %q %q %q", st.Global, st.SiteHosts, st.TLSBlock)
	}

	byID := map[string]Entry{}
	for _, e := range st.Entries {
		byID[e.ID] = e
	}
	pve, ok := byID["pve"]
	if !ok {
		t.Fatal("pve entry missing")
	}
	if pve.Scheme != "https" || pve.Upstream != "192.0.2.10:8006" || !pve.SkipVerify {
		t.Fatalf("pve parsed wrong: %+v", pve)
	}
	if pve.Name != "PVE" {
		t.Fatalf("pve name = %q", pve.Name)
	}
	couch, ok := byID["couchdb"]
	if !ok {
		t.Fatal("couchdb missing")
	}
	if couch.ReadTimeout != "3600s" || couch.WriteTimeout != "3600s" {
		t.Fatalf("couchdb timeouts: %+v", couch)
	}
	comic := byID["comic"]
	if comic.Scheme != "http" || comic.Upstream != "192.0.2.30:13001" {
		t.Fatalf("comic parsed wrong: %+v", comic)
	}
	if len(comic.Hosts) != 4 {
		t.Fatalf("comic hosts: %v", comic.Hosts)
	}

	out := render(st)
	st2, err := parseCaddyfile(out)
	if err != nil {
		t.Fatalf("reparse rendered: %v\n%s", err, out)
	}
	if len(st2.Entries) != len(st.Entries) {
		t.Fatalf("round trip entry count %d != %d", len(st2.Entries), len(st.Entries))
	}
	for _, e := range st.Entries {
		var found *Entry
		for i := range st2.Entries {
			if st2.Entries[i].ID == e.ID {
				found = &st2.Entries[i]
				break
			}
		}
		if found == nil {
			t.Fatalf("entry %s lost in round trip", e.ID)
		}
		if found.Upstream != e.Upstream || found.Scheme != e.Scheme || len(found.Hosts) != len(e.Hosts) {
			t.Fatalf("entry %s changed: %+v -> %+v", e.ID, e, *found)
		}
		if found.Extra != e.Extra {
			t.Fatalf("entry %s extra changed: %q -> %q", e.ID, e.Extra, found.Extra)
		}
	}
}

func TestCleanHosts(t *testing.T) {
	got := cleanHosts([]string{"a.com, b.com", "a.com\nc.com"})
	if len(got) != 3 {
		t.Fatalf("got %v", got)
	}
}

func TestExpandHosts(t *testing.T) {
	p := &Panel{store: Store{Suffixes: []string{"example.com", "example.net"}}}
	got := p.expandHosts([]string{"abc", "x.y.z", "abc"})
	want := []string{"abc.example.com", "abc.example.net", "x.y.z"}
	if len(got) != len(want) {
		t.Fatalf("got %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}

	bare := &Panel{}
	if out := bare.expandHosts([]string{"abc"}); len(out) != 1 || out[0] != "abc" {
		t.Fatalf("no suffixes should keep hosts literal, got %v", out)
	}
}
